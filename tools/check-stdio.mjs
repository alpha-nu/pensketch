import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Spawns the built server the way a client spawns it, and completes a real
// round trip over stdin and stdout: initialize, list the tools, call one.
//
// The suite already proves the protocol wiring through an in-memory
// transport, which is faster and needs no build. This proves the other half,
// and the half a user actually meets: that the file named by `bin` starts
// under a bare `node`, that the shebang survived the build, and that nothing
// it prints on the way up corrupts the stream a client is parsing. That last
// one is the classic failure of an npx-distributed server - one stray
// console.log and every message after it is unreadable.
//
// Run locally after `npm run build`: `npm run stdio`.

const root = new URL('../', import.meta.url);
const server = new URL('packages/mcp/dist/stdio.js', root);

if (!existsSync(server)) {
  console.error(
    'FAIL packages/mcp/dist/stdio.js is missing - run `npm run build`',
  );
  process.exit(1);
}

const child = spawn(process.execPath, [fileURLToPath(server)], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

const replies = new Map();
let pending = '';
child.stdout.on('data', (chunk) => {
  pending += chunk;
  const lines = pending.split('\n');
  pending = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.trim()) continue;
    // Anything on stdout that is not a JSON-RPC message is a broken server,
    // not a warning: the client is parsing this stream.
    const message = JSON.parse(line);
    if (message.id !== undefined) replies.get(message.id)?.(message);
  }
});

let id = 0;
const send = (method, params) =>
  new Promise((resolve, reject) => {
    const request = { jsonrpc: '2.0', id: ++id, method, params };
    replies.set(request.id, resolve);
    setTimeout(
      () => reject(new Error(`${method} did not answer within 20s`)),
      20_000,
    ).unref();
    child.stdin.write(`${JSON.stringify(request)}\n`);
  });

const notify = (method, params) =>
  child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);

let failed = false;
const check = (label, ok, detail = '') => {
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`,
  );
  failed = failed || !ok;
};

try {
  const init = await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'check-stdio', version: '0' },
  });
  check(
    'initialize',
    init.result?.serverInfo?.name === 'pensketch',
    `${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version}`,
  );
  notify('notifications/initialized');

  const tools = await send('tools/list');
  const names = (tools.result?.tools ?? []).map((t) => t.name).sort();
  check(
    'tools/list',
    names.join() === 'check_diagram,render_diagram,render_png',
    names.join(', '),
  );

  const resources = await send('resources/list');
  check(
    'resources/list',
    (resources.result?.resources ?? []).length === 6,
    `${resources.result?.resources?.length} resources`,
  );

  // A real call, not a ping: the checker over a diagram with a defect it must
  // find, so a server that answers but does nothing useful still fails.
  const call = await send('tools/call', {
    name: 'check_diagram',
    arguments: {
      diagram: {
        nodes: [
          { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
          { id: 'b', shape: 'box', x: 40, y: 10, w: 100, h: 40 },
        ],
      },
    },
  });
  check(
    'tools/call check_diagram',
    call.result?.content?.[0]?.text?.includes('node-overlap') === true,
    (call.result?.content?.[0]?.text ?? '').split('\n')[0],
  );

  // The tool most likely to break in a sandbox: it initialises WebAssembly
  // and reads a font. If that goes wrong, it goes wrong here rather than in
  // front of a user.
  const png = await send('tools/call', {
    name: 'render_png',
    arguments: {
      diagram: {
        nodes: [
          {
            id: 'a',
            shape: 'box',
            x: 10,
            y: 10,
            w: 100,
            h: 40,
            lines: ['hello'],
          },
        ],
      },
      viewBox: [0, 0, 200, 80],
    },
  });
  const data = png.result?.content?.[0]?.data ?? '';
  check(
    'tools/call render_png',
    Buffer.from(data, 'base64').subarray(0, 4).toString('hex') === '89504e47',
    `${Math.round(data.length / 1024)} KB of base64`,
  );
} catch (error) {
  check('round trip', false, String(error));
} finally {
  child.kill();
}

if (stderr.trim()) console.log(`\nserver stderr:\n${stderr.trim()}`);

if (failed) {
  process.exit(1);
}
