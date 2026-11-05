import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function mainCommit(tag, git) {
  let sha;
  try {
    sha = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
    if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error();
    git('merge-base', '--is-ancestor', sha, 'origin/main');
  } catch {
    throw new Error(
      'The release must reference a commit already merged into main',
    );
  }
  return sha;
}

function requireSuccessfulCI(runs, sha) {
  const latest = runs.workflow_runs?.[0];
  const invalid = [
    latest?.head_sha !== sha,
    latest?.head_branch !== 'main',
    latest?.event !== 'push',
    latest?.status !== 'completed',
    latest?.conclusion !== 'success',
  ];
  if (invalid.some(Boolean))
    throw new Error(
      'The release commit needs a successful main push CI run; wait for CI or rerun it',
    );
}

export async function verifyRelease(
  { tag, repository, token },
  {
    request = globalThis.fetch,
    git = (...args) =>
      execFileSync('git', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
  } = {},
) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || !/^[\w.-]+\/[\w.-]+$/.test(repository))
    throw new Error(
      'Select a published stable release named vMAJOR.MINOR.PATCH',
    );
  const api = async (path) => {
    const response = await request(
      `https://api.github.com/repos/${repository}/${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!response.ok)
      throw new Error('Unable to verify release or CI through GitHub');
    return response.json();
  };
  const release = await api(`releases/tags/${encodeURIComponent(tag)}`);
  if (release.draft || release.prerelease || release.tag_name !== tag)
    throw new Error('Only published stable releases can be deployed');
  const sha = mainCommit(tag, git);
  const runs = await api(
    `actions/workflows/ci.yml/runs?head_sha=${sha}&branch=main&event=push&per_page=1`,
  );
  requireSuccessfulCI(runs, sha);
  return sha;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  verifyRelease({
    tag: process.env.RELEASE_TAG,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GH_TOKEN,
  })
    .then((sha) => console.log(sha))
    .catch(() => {
      console.error(
        'Release verification failed: require a stable vMAJOR.MINOR.PATCH release on main with successful CI',
      );
      process.exitCode = 1;
    });
}
