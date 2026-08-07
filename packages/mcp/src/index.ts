import { McpServer } from '@modelcontextprotocol/server';

/**
 * Builds the server, with no transport attached to it.
 *
 * The transport lives in `stdio.ts`, a few lines away, so that adding a
 * second one is additive rather than a rewrite — and so that the tools and
 * resources can be exercised in a test without a process to talk to.
 *
 * Tools and resources are registered in the commits that add them; this is
 * the shape they hang off.
 */
export function createServer(): McpServer {
  return new McpServer({
    name: 'pensketch',
    version: __MCP_VERSION__,
  });
}
