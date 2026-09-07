import {
  createMcpHandler,
  hostHeaderValidationResponse,
  type McpHttpHandler,
  originValidationResponse,
} from '@modelcontextprotocol/server';

import { baseServer } from './factory';

// The second transport, and nothing else. It names no tool, no resource and
// no geometry, the rule `stdio.ts` already holds.
//
// Nothing here imports from `node:`, and that is a constraint rather than an
// accident: this is the entry an edge runtime bundles. `serve.ts` holds the
// socket and everything that needs one, and `render_png` is not reachable
// from here at all - `factory.ts` explains why that is structural rather than
// a flag. `npm run edge` fails if a Node built-in finds its way back in.

/**
 * The names a request may carry in `Host` and `Origin` and still be served.
 *
 * Exported for `serve.ts`, which hands the same list to the Node-side guards
 * so both spellings of this transport admit exactly the same names.
 */
export const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

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
export function createHandler(
  onerror: (error: Error) => void = () => {},
): McpHttpHandler {
  // `onerror` is the only sink there is. Without it a factory throw, a
  // content-type rejection and an unsupported protocol version all reach the
  // caller as a bare `-32603 Internal server error` and reach the operator as
  // nothing at all - the response is identical either way, so this callback
  // is the difference between a diagnosable server and a silent one.
  return createMcpHandler(() => baseServer(), { onerror });
}

/**
 * The same handler with the DNS rebinding guards in front, for a runtime that
 * has no `node:http` to hang them off.
 *
 * `createHandler` is deliberately validation-free — the SDK says so of its own
 * entry — and that is correct for a deployment already behind something that
 * validates. It is wrong as a default, because the guards are the difference
 * between an endpoint the operator exposed and one every page the user has
 * open can reach. So this is what the documentation shows.
 */
export function createGuardedHandler({
  allowedHosts = LOOPBACK,
  allowedOrigins = allowedHosts,
  onerror = () => {},
}: {
  allowedHosts?: string[];
  allowedOrigins?: string[];
  onerror?: (error: Error) => void;
} = {}): { fetch: (request: Request) => Promise<Response> } {
  const handler = createHandler(onerror);
  return {
    fetch: async (request: Request) =>
      hostHeaderValidationResponse(request, allowedHosts) ??
      originValidationResponse(request, allowedOrigins) ??
      handler.fetch(request),
  };
}
