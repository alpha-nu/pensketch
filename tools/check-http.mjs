import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Spawns the built HTTP server the way a deployment spawns it, and completes
// a real round trip over a socket: initialize, list the tools, call one.
//
// The suite already drives the handler through `fetch` with no socket at all,
// which is faster and needs no build. This proves the other half, and the
// half an operator actually meets: that the file named by `bin` starts under
// a bare `node`, that the shebang survived the build, that the shared chunks
// code splitting produces resolve at runtime, and that it says where it is
// listening on stderr rather than on stdout.
//
// It also proves the one thing the SVG-only decision rests on being visible
// from outside: `render_png` is absent from the tool list here and present
// over stdio.
//
// Run locally after `npm run build`: `npm run http`.

const root = new URL('../', import.meta.url);
const bin = new URL('packages/mcp/dist/serve-http.js', root);

if (!existsSync(bin)) {
  console.error(
    'FAIL packages/mcp/dist/serve-http.js is missing - run `npm run build`',
  );
  process.exit(1);
}

// A port nothing else in this repository uses, high enough to need no
// privilege. A busy one fails loudly below rather than hanging.
const PORT = 39517;
const HOST = '127.0.0.1';
const at = `http://${HOST}:${PORT}/`;

const child = spawn(
  process.execPath,
  [fileURLToPath(bin), String(PORT), HOST],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk;
});
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

const fail = (message) => {
  console.error(`FAIL ${message}`);
  if (stderr.trim()) console.error(`  stderr: ${stderr.trim()}`);
  if (stdout.trim()) console.error(`  stdout: ${stdout.trim()}`);
  child.kill();
  process.exit(1);
};

const listening = await new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), 10_000);
  child.stderr.on('data', () => {
    if (stderr.includes('listening on')) {
      clearTimeout(timer);
      resolve(true);
    }
  });
  child.once('exit', () => {
    clearTimeout(timer);
    resolve(false);
  });
});

if (!listening) fail('the server never reported itself listening');

// stdout is a JSON-RPC stream under the other transport. Nothing may print
// there, ever, so that no habit crosses between the two entries.
if (stdout !== '') fail(`it wrote to stdout: ${JSON.stringify(stdout)}`);

const { LATEST_PROTOCOL_VERSION } = await import(
  '@modelcontextprotocol/server'
);

const rpc = async (method, params) => {
  const response = await fetch(at, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': LATEST_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  const text = await response.text();
  const frames = text
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  return JSON.parse(frames.length ? frames.join('') : text);
};

const init = await rpc('initialize', {
  protocolVersion: LATEST_PROTOCOL_VERSION,
  capabilities: {},
  clientInfo: { name: 'check-http', version: '0' },
});
if (!init.result) fail(`initialize was refused: ${JSON.stringify(init)}`);

const listed = await rpc('tools/list');
const names = (listed.result?.tools ?? []).map((t) => t.name).sort();
if (names.join() !== 'check_diagram,render_diagram')
  fail(
    `expected check_diagram and render_diagram, got ${names.join() || '(none)'}`,
  );

const drawn = await rpc('tools/call', {
  name: 'render_diagram',
  arguments: {
    // Two nodes and an edge between them, so a clean diagram reports clean.
    // `shape` omitted on both, which is the other half of what this release
    // ships and would throw `unknown shape "undefined"` against a core older
    // than the floor.
    diagram: {
      nodes: [
        { id: 'a', x: 40, y: 40, w: 120, h: 46, lines: ['a'] },
        { id: 'b', x: 260, y: 40, w: 120, h: 46, lines: ['b'] },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
    },
    viewBox: [0, 0, 420, 130],
    seed: 7,
  },
});
const svg = drawn.result?.content?.[0]?.text ?? '';
if (!svg.startsWith('<svg ') || !svg.endsWith('</svg>'))
  fail(
    `render_diagram returned no svg: ${JSON.stringify(drawn).slice(0, 200)}`,
  );
if (drawn.result?.content?.[1]?.text !== 'No findings.')
  fail(
    `expected a findings block, got ${JSON.stringify(drawn.result?.content?.[1])}`,
  );

child.kill();
console.log(
  `PASS pensketch-mcp-http: listening, ${names.length} tools, ${svg.length} B of svg, stdout silent`,
);
