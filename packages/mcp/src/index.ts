import type { McpServer } from '@modelcontextprotocol/server';

import { baseServer } from './factory';
import { registerRasterTool } from './raster-tool';

/**
 * Builds the server, with no transport attached to it.
 *
 * All three tools, which is what a transport owning its own process can
 * serve. The transport lives in `stdio.ts`, a few lines away, so that a
 * second one is additive rather than a rewrite — and so that the tools and
 * resources can be exercised in a test without a process to talk to.
 *
 * `factory.ts` is this without `render_png`, for the transports that cannot
 * hold a rasterizer. The pair is what decides the tool set; there is no flag.
 */
export function createServer(): McpServer {
  const server = baseServer();
  registerRasterTool(server);
  return server;
}
