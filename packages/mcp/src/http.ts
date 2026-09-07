import { createServer as listener } from 'node:http';
import {
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import {
  createMcpHandler,
  type McpHttpHandler,
} from '@modelcontextprotocol/server';

import { createServer } from './index';

// The second transport, and nothing else. It names no tool, no resource and
// no geometry, the rule `stdio.ts` already holds - one exception, and it is
// about this transport rather than about any tool: `raster: false`. The
// rasterizer is synchronous WebAssembly that holds the event loop for
// seconds, which under stdio is one client's own business and here is
// everybody's. `createServer` is handed that fact; it decides what to do
// with it.

/** Where a handler listens, and what it will answer. */
export interface ServeOptions {
  /** TCP port. Default: `3000`, or `PORT` from the environment. */
  port?: number;
  /**
   * Interface to bind. Default: `127.0.0.1`.
   *
   * Loopback on purpose. This server has no authentication of any kind, so
   * binding it to a routable address publishes an unauthenticated endpoint,
   * and a default that does that is a default that will do it by accident.
   * Put a proxy in front and let the proxy decide who may reach it.
   */
  host?: string;
}

/**
 * The web-standard handler: `fetch(Request) => Promise<Response>`.
 *
 * The shape Workers, Bun and Deno expect from `export default`, and the shape
 * a test drives with no socket at all — which is the same reason
 * `createServer` is kept apart from `serveStdio`.
 *
 * `render_png` is absent. Not refused, absent: a description an agent cannot
 * act on is tokens it paid for and a turn it may spend finding out. Stdio
 * serves all three.
 */
export function createHandler(): McpHttpHandler {
  return createMcpHandler(() => createServer({ raster: false }));
}

/**
 * Listens, and resolves once it is listening.
 *
 * The Host and Origin guards are not optional decoration. A browser will send
 * a cross-origin request to `127.0.0.1` on behalf of any page the user has
 * open, so an unguarded local MCP endpoint is reachable by any website the
 * user visits — DNS rebinding, and the reason the SDK ships these two.
 */
export function serve({ port, host = '127.0.0.1' }: ServeOptions = {}) {
  const handler = createHandler();
  const node = toNodeHandler(handler);
  const validateHost = localhostHostValidation();
  const validateOrigin = localhostOriginValidation();

  const server = listener((request, response) => {
    if (!validateHost(request, response) || !validateOrigin(request, response))
      return;
    // `NodeIncomingMessageLike` is duck-typed so the adapter can stay free of
    // `node:` imports, and it declares `method?: string` where `IncomingMessage`
    // declares `method: string | undefined`. Under this repository's
    // `exactOptionalPropertyTypes` those are different types, and the real
    // object satisfies both. An impedance mismatch between two spellings of
    // optional, asserted at the one line where they meet.
    void node(request as unknown as Parameters<typeof node>[0], response);
  });

  const at = port ?? Number(process.env.PORT ?? 3000);
  return new Promise<{ server: typeof server; close: () => Promise<void> }>(
    (resolve, reject) => {
      server.once('error', reject);
      server.listen(at, host, () => {
        resolve({
          server,
          close: async () => {
            await handler.close();
            await new Promise<void>((done) => server.close(() => done()));
          },
        });
      });
    },
  );
}
