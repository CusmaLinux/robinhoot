import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deployRender } from './render.mjs';

const config = {
  hook: 'https://api.render.com/deploy/srv-example?key=private-key',
  apiUrl: 'https://robinhoot.onrender.com',
  image: `ghcr.io/cusmalinux/robinhoot@sha256:${'a'.repeat(64)}`,
  revision: 'b'.repeat(40),
};

test('waits for the requested release rather than accepting the old healthy process', async () => {
  const calls = [];
  const replies = [
    new Response('{}'),
    Response.json({ status: 'ok', revision: 'old' }),
    Response.json({ status: 'ok', revision: config.revision }),
  ];
  await deployRender(config, {
    fetch: async (url) => {
      calls.push(String(url));
      return replies.shift();
    },
    sleep: async () => {},
  });
  assert.equal(calls.length, 3);
  assert.equal(new URL(calls[0]).searchParams.get('imgURL'), config.image);
  assert.equal(calls[1], `${config.apiUrl}/health/ready`);
});

test('fails after a bounded wait when only the old process is healthy', async () => {
  let calls = 0;
  await assert.rejects(
    deployRender(config, {
      fetch: async () =>
        ++calls === 1
          ? new Response('{}')
          : Response.json({ status: 'ok', revision: 'old' }),
      sleep: async () => {},
      attempts: 2,
    }),
    /did not become ready/,
  );
  assert.equal(calls, 3);
});

test('does not expose provider or network errors containing the deploy secret', async () => {
  await assert.rejects(
    deployRender(config, {
      fetch: async () => {
        throw new Error(config.hook);
      },
    }),
    (error) =>
      !error.message.includes('private-key') &&
      /Render rejected/.test(error.message),
  );
});

test('does not follow redirects when sending the service secret', async () => {
  await assert.rejects(
    deployRender(config, {
      fetch: async (_url, options) => {
        assert.equal(options.redirect, 'error');
        return new Response('', { status: 302 });
      },
    }),
    /Render rejected/,
  );
});

test('rejects invalid configuration before requesting any deployment', async () => {
  for (const overrides of [
    { hook: 'https://attacker.example/deploy/srv-example?key=private-key' },
    { apiUrl: 'http://robinhoot.onrender.com' },
    { image: 'ghcr.io/cusmalinux/robinhoot:latest' },
    { revision: 'main' },
  ]) {
    await assert.rejects(
      deployRender(
        { ...config, ...overrides },
        {
          fetch: async () =>
            assert.fail('configuration must be rejected first'),
        },
      ),
      /Invalid deployment configuration/,
    );
  }
});
