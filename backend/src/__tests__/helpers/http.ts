import supertest from 'supertest';
import type { Server } from 'http';

// supertest's `request(app)` starts a fresh HTTP server and opens a fresh
// loopback socket for every call — around 2,500 listen/connect/close cycles
// in a full run of this suite. Once in a while one of those connects times
// out, and because the failure happens below the application the assertion
// sees a nonsense status (a 404 for a route that certainly exists, a 400
// where the role guard could only have returned 403) rather than a network
// error. That is what made the flake so hard to place: the statuses were
// impossible in the code because they never came from it.
//
// One listener per app, reused for the life of the worker, removes the churn.
const servers = new Map<unknown, Server>();

function request(app: any) {
  let server = servers.get(app);
  if (!server) {
    server = app.listen(0) as Server;
    // A test server must never be the reason the worker stays alive.
    server.unref();
    servers.set(app, server);
  }
  return supertest(server);
}

// The BDD specs annotate with `request.Response`, which supertest's default
// export carries as a merged namespace. Keep that working so no call site has
// to change.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace request {
  export type Response = supertest.Response;
  export type Test = supertest.Test;
}

export { request };
export default request;
