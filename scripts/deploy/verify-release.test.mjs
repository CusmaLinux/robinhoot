import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyRelease } from './verify-release.mjs';

const sha = 'a'.repeat(40);
const config = {
  tag: 'v0.1.0',
  repository: 'CusmaLinux/robinhoot',
  token: 'test-token',
};
const release = { tag_name: 'v0.1.0', draft: false, prerelease: false };
const run = {
  head_sha: sha,
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
};
function dependencies(releaseInfo = release, ciRun = run) {
  let calls = 0;
  return {
    git: (command) => (command === 'rev-parse' ? sha : ''),
    request: async () =>
      Response.json(
        ++calls === 1 ? releaseInfo : { workflow_runs: ciRun ? [ciRun] : [] },
      ),
  };
}

test('accepts a published main release with successful CI for the exact commit', async () => {
  assert.equal(await verifyRelease(config, dependencies()), sha);
});

test('rejects missing, pending, failed and different-commit CI', async () => {
  for (const ciRun of [
    null,
    { ...run, status: 'in_progress' },
    { ...run, conclusion: 'failure' },
    { ...run, head_sha: 'b'.repeat(40) },
  ])
    await assert.rejects(
      verifyRelease(config, dependencies(release, ciRun)),
      /successful main push CI/,
    );
});

test('rejects drafts and prereleases', async () => {
  for (const info of [
    { ...release, draft: true },
    { ...release, prerelease: true },
  ])
    await assert.rejects(
      verifyRelease(config, dependencies(info)),
      /published stable releases/,
    );
});

test('rejects a tag outside main', async () => {
  const deps = dependencies();
  deps.git = (command) => {
    if (command === 'merge-base') throw new Error();
    return sha;
  };
  await assert.rejects(verifyRelease(config, deps), /merged into main/);
});

test('rejects arbitrary refs before requesting GitHub', async () => {
  await assert.rejects(
    verifyRelease(
      { ...config, tag: 'main' },
      { request: async () => assert.fail() },
    ),
    /stable release named/,
  );
});
