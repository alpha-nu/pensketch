import { build } from 'esbuild';

// Asserts that `@pensketch/mcp/http` bundles for a runtime that has no Node
// built-ins - a Cloudflare Worker, a Deno Deploy project, a Bun deployment.
//
// This is a real gate rather than a formality, because the property it holds
// has been broken twice by ordinary-looking changes. The first time, `serve()`
// shared a file with the handler, so importing the handler pulled `node:http`
// and, through the SDK's Node adapter, `http2`, `stream` and `crypto`. The
// second time the rasterizer was behind `await import('./render')`, which
// reads as lazy and is not: a bundler follows a dynamic import and resolves
// what it finds, so `node:fs` and `node:module` came in anyway.
//
// Neither was visible from the source, and neither broke a test. Only
// bundling it finds them, so that is what this does.
//
// Run: `npm run edge`. Needs `npm run build` first.

const root = new URL('../', import.meta.url);

const entry = `
import { createGuardedHandler } from '@pensketch/mcp/http';
export default { fetch: createGuardedHandler({ allowedHosts: ['mcp.example.com'] }).fetch };
`;

let problems = 0;
const fail = (message) => {
  console.error(`FAIL check-edge: ${message}`);
  problems++;
};

let bundled;
try {
  const result = await build({
    stdin: { contents: entry, resolveDir: root.pathname, loader: 'js' },
    bundle: true,
    format: 'esm',
    // The two together are what "no Node built-ins" means to a bundler: a
    // browser platform refuses to polyfill them, and the worker condition
    // picks the same export a deployment would.
    platform: 'browser',
    conditions: ['worker', 'browser'],
    write: false,
    logLevel: 'silent',
  });
  bundled = result.outputFiles[0].contents.length;
} catch (error) {
  const blocked = [
    ...new Set(
      (error.errors ?? [])
        .map((e) => e.text.match(/Could not resolve "([^"]+)"/)?.[1])
        .filter(Boolean),
    ),
  ];
  fail(
    blocked.length
      ? `\`@pensketch/mcp/http\` reaches ${blocked.map((b) => `\`${b}\``).join(', ')}, which an edge runtime does not have. Something in that graph imported a Node built-in, directly or through a dependency. Anything needing one belongs in \`serve.ts\` or behind \`index.ts\`, neither of which this entry may import.`
      : `bundling \`@pensketch/mcp/http\` failed: ${error.message}`,
  );
}

// The graph being clean is half of it. The other half is that the handler
// still serves the two tools it is meant to - a bundle that is clean because
// it does nothing would pass the check above.
if (!problems) {
  const { createHandler } = await import(
    new URL('packages/mcp/dist/http.js', root)
  );
  const handler = createHandler();
  const response = await handler.fetch(
    new Request('http://127.0.0.1/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }),
  );
  const text = await response.text();
  const line = text.split('\n').find((l) => l.startsWith('data: '));
  const tools = (JSON.parse(line.slice(6)).result?.tools ?? [])
    .map((t) => t.name)
    .sort();

  const expected = ['check_diagram', 'get_schema', 'render_diagram'];
  if (tools.join() !== expected.join())
    fail(
      `the edge handler lists ${JSON.stringify(tools)}, expected ${JSON.stringify(expected)}. \`render_png\` being present would mean the rasterizer is reachable from this entry after all.`,
    );
  else
    console.log(
      `PASS check-edge: @pensketch/mcp/http bundles for a worker target with no Node built-in (${(bundled / 1024).toFixed(0)} KB unminified), serving ${tools.join(', ')}`,
    );
}

process.exit(problems ? 1 : 0);
