import './helpers/setup.js';
import assert from 'node:assert/strict';
import http from 'node:http';
import { afterEach, describe, it } from 'node:test';
import express from 'express';
import { createApp } from '../src/app.js';
import { createGracefulShutdown } from '../src/utils/gracefulShutdown.js';
import { createTestConfig } from './helpers/testDb.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Starts `app` on a random port and returns helpers bound to a keep-alive agent. */
async function start(app) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

  const get = (path) =>
    new Promise((resolve, reject) => {
      http
        .get({ port: server.address().port, path, agent }, (response) => {
          response.resume();
          response.on('end', () =>
            resolve({ status: response.statusCode, connection: response.headers.connection }),
          );
        })
        .on('error', reject);
    });

  return { server, agent, get };
}

/** A shutdown coordinator whose exit and cleanup are observable instead of real. */
function createLifecycle(options = {}) {
  const calls = { cleanup: 0 };
  let resolveExit;
  const exited = new Promise((resolve) => {
    resolveExit = resolve;
  });
  const lifecycle = createGracefulShutdown({
    cleanup: async () => {
      calls.cleanup += 1;
      if (options.cleanupError) throw options.cleanupError;
    },
    exit: resolveExit,
    timeoutMs: options.timeoutMs ?? 5000,
  });
  return { lifecycle, exited, calls };
}

describe('graceful shutdown', () => {
  let running;

  afterEach(() => {
    running?.agent.destroy();
    running?.server.closeAllConnections();
    running?.server.close();
    running = undefined;
  });

  it('lets a request in flight finish, then closes the kept-alive connection and exits 0', async () => {
    const { lifecycle, exited, calls } = createLifecycle();
    const app = createApp(createTestConfig(), { isShuttingDown: lifecycle.isShuttingDown });
    // A slow route, registered through a wrapper so it runs before the 404 handler.
    const wrapper = express();
    wrapper.get('/slow', async (_req, res) => {
      await wait(300);
      res.json({ done: true });
    });
    wrapper.use(app);

    running = await start(wrapper);
    lifecycle.attach(running.server);

    // Open a keep-alive connection, then start a slow request on it.
    const warmUp = await running.get('/slow');
    assert.equal(warmUp.status, 200);
    assert.equal(warmUp.connection, 'keep-alive');

    const inFlight = running.get('/slow');
    await wait(50);
    const startedAt = Date.now();
    lifecycle.shutdown('TEST');
    assert.equal(lifecycle.isShuttingDown(), true);

    assert.equal((await inFlight).status, 200, 'the request in flight must complete');
    assert.equal(await exited, 0);
    // Well under the 5 s keep-alive timeout: the idle socket was closed actively.
    assert.ok(Date.now() - startedAt < 2000);
    assert.equal(calls.cleanup, 1);
    assert.equal(running.server.listening, false);
  });

  it('asks clients to close their connection while shutting down', async () => {
    let draining = false;
    const app = createApp(createTestConfig(), { isShuttingDown: () => draining });
    running = await start(app);

    assert.equal((await running.get('/api/unknown')).connection, 'keep-alive');
    draining = true;
    assert.equal((await running.get('/api/unknown')).connection, 'close');
  });

  it('cuts connections that outlive the deadline, still runs cleanup, and exits 1', async () => {
    const { lifecycle, exited, calls } = createLifecycle({ timeoutMs: 200 });
    const app = express();
    app.get('/hang', () => {
      // Never answers.
    });

    running = await start(app);
    lifecycle.attach(running.server);

    const hanging = running.get('/hang').then(
      () => 'answered',
      () => 'cut',
    );
    await wait(50);
    lifecycle.shutdown('TEST');

    assert.equal(await exited, 1);
    assert.equal(await hanging, 'cut');
    assert.equal(calls.cleanup, 1);
  });

  it('exits 1 when cleanup fails and ignores repeated signals', async () => {
    const { lifecycle, exited, calls } = createLifecycle({
      cleanupError: new Error('disconnect failed'),
    });
    running = await start(express());
    lifecycle.attach(running.server);

    lifecycle.shutdown('SIGTERM');
    lifecycle.shutdown('SIGINT');

    assert.equal(await exited, 1);
    await wait(20);
    assert.equal(calls.cleanup, 1);
  });
});
