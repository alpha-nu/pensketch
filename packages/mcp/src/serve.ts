import { createServer as listener } from 'node:http';
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';

import { createHandler, LOOPBACK } from './http';

// The Node listener, kept apart from the handler it wraps.
//
// `http.ts` is the transport as a web-standard `fetch`, and it imports
// nothing from `node:`. This file is what turns that into a socket, and it
// imports `node:http` and the SDK's Node adapter - which reaches `http2`,
// `stream` and `crypto` through `@hono/node-server`.
//
// The split is the whole point. A Worker, a Deno Deploy project or a Bun
// deployment imports `@pensketch/mcp/http` and gets a graph with no Node
// built-in in it; `pensketch-mcp http` imports this. Before the two lived
// apart, importing the handler dragged `createServer` in with it and no edge
// runtime could bundle it at all.

/**
 * The largest body this transport will read, in bytes.
 *
 * The tools bound what a diagram may hold and refuse a 501st node, but that
 * refusal is downstream of parsing: without this, a 256 MB body is read into
 * memory and parsed before anything looks at how many nodes it names. The
 * bound above puts a 500-node diagram at about 30 KB serialized, so a
 * megabyte is some thirty times the largest request that can succeed.
 */
const MAX_BODY = 1024 * 1024;

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
   *
   * Binding anything else requires `allowedHosts`, and `serve` throws rather
   * than binding without it — see there for why a silent bind would be worse.
   */
  host?: string;
  /**
   * Hostnames a request may name in `Host`. Default: loopback only.
   *
   * The DNS rebinding guard, and the reason it cannot simply follow `host`: a
   * browser will send a cross-origin request to `127.0.0.1` on behalf of any
   * page the user has open, so a local endpoint that does not check this is
   * reachable by every site they visit.
   *
   * A proxy in front has to be part of this decision, because most preserve
   * the client's `Host` rather than rewriting it — Caddy's `reverse_proxy`
   * and Traefik do, nginx's default `proxy_set_header Host $proxy_host` does
   * not. Whichever name reaches this server is the one to list.
   */
  allowedHosts?: string[];
  /** Origins a browser request may carry. Default: loopback only. */
  allowedOrigins?: string[];
  /**
   * Where an out-of-band error goes. Default: stderr.
   *
   * stderr rather than stdout, always: stdout is a JSON-RPC stream under the
   * other transport and one habit must not cross over.
   */
  onerror?: (error: Error) => void;
}

/**
 * Listens, and resolves once it is listening.
 *
 * The Host and Origin guards are not optional decoration. A browser will send
 * a cross-origin request to `127.0.0.1` on behalf of any page the user has
 * open, so an unguarded local MCP endpoint is reachable by any website the
 * user visits — DNS rebinding, and the reason the SDK ships these two.
 */
export function serve({
  port,
  host = '127.0.0.1',
  allowedHosts,
  allowedOrigins,
  onerror: report = (error: Error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
  },
}: ServeOptions = {}) {
  // Three things a wide bind could do, and this is the third. The SDK's own
  // app factories install no validation at all in this case and print a
  // warning, which is insecure by default. Leaving the loopback allowlist in
  // place brings the socket up and then 403s every request that reaches it
  // for naming a host nobody configured, which is a dead server that looks
  // alive. Refusing to start names the option and is the only one of the
  // three a reader can act on.
  if (!LOOPBACK.includes(host) && !allowedHosts)
    throw new Error(
      `serve() will not bind ${host} without allowedHosts: every request would be refused 403 for naming a host the rebinding guard does not admit. Pass the hostnames this server will be reached by, and put something in front of it that decides who may reach it - there is no authentication here.`,
    );

  const handler = createHandler(report);
  const node = toNodeHandler(handler, { onerror: report });
  const validateHost = hostHeaderValidation(allowedHosts ?? LOOPBACK);
  const validateOrigin = originValidation(
    allowedOrigins ?? allowedHosts ?? LOOPBACK,
  );

  const server = listener((request, response) => {
    if (!validateHost(request, response) || !validateOrigin(request, response))
      return;

    // Both halves, because either alone is a hole: a declared length is a
    // claim, and a request that declares nothing still arrives.
    //
    // The two are answered differently, and that is not a shortcut. A
    // declared length is known before anything is dispatched, so it gets a
    // 413 anyone can read. A chunked body is only known to be too big once
    // the adapter already owns the response, and writing a second status
    // there throws `ERR_HTTP_HEADERS_SENT` out of a promise nothing awaits -
    // which is a crashed server rather than a refused request. So that one
    // cuts the connection and says nothing, which is what a refusal of a body
    // you will not finish reading actually looks like.
    if (Number(request.headers['content-length'] ?? 0) > MAX_BODY) {
      response.writeHead(413, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: `Request body over ${MAX_BODY} bytes. The largest diagram the tools will accept serializes to about 30 KB, so this is some thirty times the biggest request that could succeed.`,
          },
          id: null,
        }),
      );
      return request.destroy();
    }

    let read = 0;
    request.on('data', (chunk: { length: number }) => {
      read += chunk.length;
      if (read > MAX_BODY) request.destroy();
    });
    // `NodeIncomingMessageLike` is duck-typed so the adapter can stay free of
    // `node:` imports, and it declares `method?: string` where `IncomingMessage`
    // declares `method: string | undefined`. Under this repository's
    // `exactOptionalPropertyTypes` those are different types, and the real
    // object satisfies both. An impedance mismatch between two spellings of
    // optional, asserted at the one line where they meet.
    // `.catch`, not `void`. An adapter rejection is otherwise an unhandled
    // rejection, and an unhandled rejection takes the process with it - one
    // malformed request ending the server for every other client.
    void node(request as unknown as Parameters<typeof node>[0], response).catch(
      report,
    );
  });

  const at = port ?? Number(process.env.PORT ?? 3000);
  return new Promise<{ server: typeof server; close: () => Promise<void> }>(
    (resolve, reject) => {
      // The handler exists before the socket does, so a bind that fails
      // leaves it orphaned along with its event bus. Garbage rather than a
      // hang, but a consumer retrying ports in-process would accumulate one
      // per attempt.
      server.once('error', (error) => {
        void handler.close().finally(() => reject(error));
      });
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
