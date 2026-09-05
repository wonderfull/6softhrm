import supertest from 'supertest';
import type { Server } from 'http';

// Two problems with driving 400-odd HTTP assertions through supertest.
//
// First, `request(app)` starts a fresh server on every call — thousands of
// listen/close cycles per run. One listener per app, reused, removes that.
//
// Second, and the reason this file exists: loopback connections occasionally
// fail outright. macOS hands out ephemeral ports near-sequentially, so a
// connect can land on a port still in TIME_WAIT and the SYN is dropped —
// `connect ETIMEDOUT 127.0.0.1:58585`. Because that happens below the
// application, the assertion sees a nonsense status rather than a network
// error: a 404 for a route that certainly exists, a 400 where the role guard
// could only have returned 403. Hours went into looking for those bugs in the
// code, where they never were.
//
// None of these tests assert anything about TCP, so a connection that never
// reached the app is retried. Anything the application actually answered —
// any status at all — is passed straight through untouched.

const servers = new Map<unknown, Server>();

const TRANSIENT = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNABORTED',
  'EPIPE',
]);

const ATTEMPTS = 3;

function serverFor(app: any): Server {
  let server = servers.get(app);
  if (!server) {
    server = app.listen(0) as Server;
    // A test server must never be the reason the worker stays alive.
    server.unref();
    servers.set(app, server);
  }
  if (!server.address()) {
    throw new Error('Test HTTP server is not listening');
  }
  return server;
}

const isTransient = (error: any) =>
  TRANSIENT.has(error?.code) || TRANSIENT.has(error?.errno);

/**
 * Records the chain (`.set().send().expect()`) so it can be replayed against a
 * fresh request if the connection, rather than the application, failed.
 */
function recorder(server: Server, verb: string, verbArgs: any[]): supertest.Test {
  const chain: Array<[string, any[]]> = [];

  const build = () => {
    let test = (supertest(server) as any)[verb](...verbArgs);
    for (const [method, args] of chain) test = test[method](...args);
    return test;
  };

  const run = async () => {
    let lastError: any;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      try {
        return await build();
      } catch (error: any) {
        if (!isTransient(error)) throw error;
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
    throw lastError;
  };

  const proxy: any = new Proxy(
    {},
    {
      get(_target, property: string) {
        if (property === 'then')
          return (onOk: any, onErr: any) => run().then(onOk, onErr);
        if (property === 'catch') return (onErr: any) => run().catch(onErr);
        if (property === 'finally') return (fn: any) => run().finally(fn);
        return (...args: any[]) => {
          chain.push([property, args]);
          return proxy;
        };
      },
    },
  );

  return proxy as supertest.Test;
}

// Typed as supertest's own agent so the recorded chain keeps its types — a
// bare `any` here silently drops the parameter types inside `.parse()`.
function request(app: any): ReturnType<typeof supertest> {
  const server = serverFor(app);
  return new Proxy(
    {},
    {
      get:
        (_target, verb: string) =>
        (...args: any[]) =>
          recorder(server, verb, args),
    },
  ) as ReturnType<typeof supertest>;
}

// The BDD specs annotate with `request.Response`, which supertest's default
// export carries as a merged namespace. Keep that working so no call site has
// to change.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace request {
  export type Response = supertest.Response;
  export type Test = supertest.Test;
}

/** Close every server this file opened. Registered by the shared setup. */
export async function closeTestServers(): Promise<void> {
  const open = [...servers.values()];
  servers.clear();
  await Promise.all(
    open.map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
}

export { request };
export default request;
