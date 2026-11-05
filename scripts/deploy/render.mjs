import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

function deploymentUrls({ hook, apiUrl, image, revision }) {
  let hookUrl;
  let readinessUrl;
  try {
    hookUrl = new URL(hook);
    const api = new URL(apiUrl);
    const invalid = [
      hookUrl.origin !== 'https://api.render.com',
      !/^\/deploy\/srv-[a-zA-Z0-9-]+$/.test(hookUrl.pathname),
      !hookUrl.searchParams.get('key'),
      hookUrl.username,
      hookUrl.password,
      api.protocol !== 'https:',
      api.username,
      api.password,
      api.pathname !== '/',
      api.search,
      api.hash,
      !/^ghcr\.io\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(image),
      !/^[a-f0-9]{40}$/.test(revision),
    ];
    if (invalid.some(Boolean)) throw new Error();
    hookUrl.searchParams.set('imgURL', image);
    readinessUrl = new URL('/health/ready', api);
    return { hookUrl, readinessUrl };
  } catch {
    throw new Error(
      'Invalid deployment configuration; check hook, API URL and image digest',
    );
  }
}

async function requestDeployment(hookUrl, request) {
  try {
    const response = await request(hookUrl, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error();
  } catch {
    // Do not echo the secret URL, provider response or nested network error.
    throw new Error(
      'Render rejected the deployment request; inspect the Render dashboard',
    );
  }
}

async function waitForRevision(
  readinessUrl,
  revision,
  { request, sleep, attempts },
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await request(readinessUrl, {
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (response.ok) {
        const health = await response.json();
        if (health.status === 'ok' && health.revision === revision) return;
      }
    } catch {
      /* Cold starts and replacement processes can be temporarily unavailable. */
    }
    if (attempt + 1 < attempts) await sleep(10000);
  }
  throw new Error(
    'The requested release did not become ready; inspect Render before retrying',
  );
}

export async function deployRender(
  config,
  { fetch: request = globalThis.fetch, sleep = setTimeout, attempts = 60 } = {},
) {
  const { hookUrl, readinessUrl } = deploymentUrls(config);
  await requestDeployment(hookUrl, request);
  await waitForRevision(readinessUrl, config.revision, {
    request,
    sleep,
    attempts,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  deployRender({
    hook: process.env.RENDER_DEPLOY_HOOK_URL,
    apiUrl: process.env.API_BASE_URL,
    image: process.env.IMAGE_REF,
    revision: process.env.RELEASE_SHA,
  })
    .then(() => console.log('Requested release is ready'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
