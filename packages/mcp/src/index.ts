import { McpServer } from '@modelcontextprotocol/server';

import { registerResources } from './resources';
import { registerTools, type ToolOptions } from './tools';

export type { ToolOptions };

/**
 * Builds the server, with no transport attached to it.
 *
 * The transport lives in `stdio.ts`, a few lines away, so that adding a
 * second one is additive rather than a rewrite — and so that the tools and
 * resources can be exercised in a test without a process to talk to.
 *
 */
export function createServer(options: ToolOptions = {}): McpServer {
  const server = new McpServer({
    name: 'pensketch',
    version: __MCP_VERSION__,
  });
  registerTools(server, options);
  registerResources(server);
  return server;
}
