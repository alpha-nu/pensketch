import { McpServer } from '@modelcontextprotocol/server';

import { registerResources } from './resources';
import { registerTools } from './tools';

// The half of the server every transport serves, and the reason it is its own
// file: nothing reachable from here may import `node:` anything.
//
// `render_png` is not in it. The rasterizer is synchronous WebAssembly loaded
// off the filesystem, so a module that can reach it is a module an edge
// runtime cannot load - and a bundler follows a dynamic import as readily as a
// static one, so hiding it behind `await import()` does not help. `index.ts`
// is this plus the rasterizer, for the transports that own a process.
//
// `npm run edge` is what holds this: it bundles `./http` for a worker target
// and fails on any Node built-in that finds its way into the graph.

/** The server as an edge runtime can have it: `check_diagram` and `render_diagram`. */
export function baseServer(): McpServer {
  const server = new McpServer({
    name: 'pensketch',
    version: __MCP_VERSION__,
  });
  registerTools(server);
  registerResources(server);
  return server;
}
