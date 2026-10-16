/**
 * DEVELOPMENT ONLY: starts a local MongoDB for machines without a MongoDB
 * installation or Docker.
 *
 * This is a real `mongod` server process (the official binary, downloaded and
 * managed by mongodb-memory-server), not a mock. Data is persisted in
 * backend/.mongo-data between runs. Do not use it in production.
 *
 * If something already listens on the MongoDB port (a local install or the
 * docker compose service), the script leaves it alone and exits.
 */
import dotenv from 'dotenv';
import { mkdir } from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MONGODB_BINARY_VERSION } from './mongoBinary.js';

dotenv.config({ quiet: true });

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.mongo-data');

const log = (message) => console.log(`[dev-mongo] ${message}`);

function parseTarget(uri) {
  if (uri.startsWith('mongodb+srv://')) return null;
  try {
    // The WHATWG parser handles single-host mongodb:// URIs.
    const url = new URL(uri);
    return { host: url.hostname, port: Number(url.port || 27017) };
  } catch {
    return null;
  }
}

function isPortOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1000, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/logistics_map';
  const target = parseTarget(uri);

  if (!target || !LOCAL_HOSTS.has(target.host)) {
    log('MONGODB_URI points to a remote database; the embedded MongoDB is not needed.');
    return;
  }

  if (await isPortOpen('127.0.0.1', target.port)) {
    log(`A MongoDB server already listens on port ${target.port}; using it.`);
    return;
  }

  await mkdir(DATA_DIR, { recursive: true });
  log(`Starting embedded mongod ${MONGODB_BINARY_VERSION} (first run downloads the binary)...`);

  const mongod = await MongoMemoryServer.create({
    binary: { version: MONGODB_BINARY_VERSION },
    instance: {
      ip: '127.0.0.1',
      port: target.port,
      dbPath: DATA_DIR,
      storageEngine: 'wiredTiger',
    },
  });

  log(`Embedded MongoDB (development only) ready on mongodb://127.0.0.1:${target.port}`);
  log(`Data directory: ${DATA_DIR}`);

  const stop = async () => {
    log('Stopping embedded MongoDB...');
    // The data directory is kept so stores survive restarts.
    await mongod.stop({ doCleanup: false });
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

main().catch((error) => {
  console.error(`[dev-mongo] Failed to start embedded MongoDB: ${error.message}`);
  process.exit(1);
});
