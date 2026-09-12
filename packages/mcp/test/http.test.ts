import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { baseServer } from '../src/factory';
import { createGuardedHandler, createHandler } from '../src/http';
import { createServer } from '../src/index';
import { serve } from '../src/serve';
import { svgFor } from '../src/tools';

const FLOW = {
  nodes: [
    {
      id: 'in',
      shape: 'pill',
      x: 40,
      y: 50,
      w: 160,
      h: 50,
      lines: ['request'],
    },
    { id: 'gate', x: 260, y: 35, w: 150, h: 80, lines: ['allowed?'] },
  ],
  edges: [{ from: ['in', 'r'], to: ['gate', 'l'] }],
};
const VIEW_BOX = [0, 0, 460, 150] as [number, number, number, number];

// Read from the SDK rather than written down. A protocol version pinned by
// hand here would go stale on an SDK bump and fail as a test bug rather than
// as the incompatibility it would actually be.
const VERSION = LATEST_PROTOCOL_VERSION;

/**
 * One JSON-RPC exchange against a fetch-shaped handler. No socket, no port,
 * no process — the same reason `createServer` is kept apart from its
 * transport, applied one layer up.
 */
const rpc = async (
  fetchLike: (request: Request) => Promise<Response>,
  method: string,
  params?: unknown,
  origin = 'http://127.0.0.1',
) => {
  const response = await fetchLike(
    new Request(`${origin}/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': VERSION,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        ...(params === undefined ? {} : { params }),
      }),
    }),
  );
  const text = await response.text();
  // An exchange answers with a JSON body unless it streams, and a stream
  // wraps the same payload in `event:`/`data:` frames. Read either, by
  // looking for the frames rather than by trusting a content type.
  const frames = text
    .split('\n')
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  const body = frames.length ? frames.join('') : text;
  return {
    status: response.status,
    body: JSON.parse(body) as {
      result?: { content?: { text?: string }[]; tools?: { name: string }[] };
      error?: { message?: string };
    },
  };
};

/**
 * A handler that has been initialized.
 *
 * Not because it has to be: the legacy path builds a fresh server per POST
 * with no session id at all, so `tools/list` answers a handler that has never
 * seen an `initialize`. The handshake is here because it is what a client
 * does, and because a test that skips it would stop noticing if that ever
 * stopped being true.
 */
const opened = async () => {
  const { fetch } = createHandler();
  await rpc(fetch, 'initialize', {
    protocolVersion: VERSION,
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  return fetch;
};

describe('the http handler', () => {
  it('serves everything but render_png', async () => {
    const fetch = await opened();
    const { body } = await rpc(fetch, 'tools/list');

    expect((body.result?.tools ?? []).map((t) => t.name).sort()).toEqual([
      'check_diagram',
      'get_schema',
      'render_diagram',
    ]);
  });

  // The rule is absence rather than refusal. An agent pays for every tool
  // description it is sent, and one it cannot call is tokens spent plus a turn
  // it may spend finding out. Stdio keeps all three.
  //
  // Two factories rather than a flag, and the difference is load-bearing:
  // `baseServer` cannot reach `render.ts`, so nothing that imports it can
  // reach `node:fs` or the WebAssembly either. A boolean would have left that
  // import in the graph of both.
  it('leaves every tool on stdio', () => {
    const all = createServer();
    const svgOnly = baseServer();
    const names = (s: ReturnType<typeof createServer>) =>
      Object.keys(
        (s as unknown as { _registeredTools: Record<string, unknown> })
          ._registeredTools,
      ).sort();

    expect(names(all)).toEqual([
      'check_diagram',
      'get_schema',
      'render_diagram',
      'render_png',
    ]);
    expect(names(svgOnly)).toEqual([
      'check_diagram',
      'get_schema',
      'render_diagram',
    ]);
  });

  // The requirement the delta states plainly: nothing outside the arguments
  // is read, so the transport cannot be observed from inside a tool.
  it('draws the same bytes the stdio server draws', async () => {
    const fetch = await opened();
    const { body } = await rpc(fetch, 'tools/call', {
      name: 'render_diagram',
      arguments: { diagram: FLOW, viewBox: VIEW_BOX, seed: 7 },
    });

    expect(body.result?.content?.[0]?.text).toBe(
      svgFor(FLOW, VIEW_BOX, { seed: 7 }),
    );
    expect(body.result?.content?.[1]?.text).toBe('No findings.');
  });

  // Absence, not refusal. The tool is not registered, so the SDK answers a
  // call naming it as an unknown method - `not found`, not a message about
  // transports. Asserted for what it is rather than for what would be nicer,
  // because a scenario that says "it names stdio" and a server that says
  // "not found" cannot both be the specification.
  it('answers a render_png call as an unknown tool', async () => {
    const fetch = await opened();
    const { body } = await rpc(fetch, 'tools/call', {
      name: 'render_png',
      arguments: { diagram: FLOW, viewBox: VIEW_BOX },
    });

    const said = body.result?.content?.[0]?.text ?? body.error?.message ?? '';
    expect(said).toContain('render_png');
    expect(said).toMatch(/not found|unknown/i);
  });
});

describe('the listener', () => {
  // A browser sends a cross-origin request to 127.0.0.1 on behalf of whatever
  // page the user has open, so an unguarded local endpoint is reachable by any
  // site they visit. This is the one behaviour of the bridge that is a
  // security property rather than plumbing, so it is asserted over a real
  // socket rather than trusted to the adapter.
  it('answers a loopback request and turns away a foreign origin', async () => {
    // Port 0 asks the OS for a free one; read back what it gave.
    const { server, close } = await serve({ port: 0, host: '127.0.0.1' });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const at = `http://127.0.0.1:${port}/`;

    const post = (headers: Record<string, string>) =>
      fetch(at, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': VERSION,
          ...headers,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '0' },
          },
        }),
      });

    try {
      expect((await post({})).status).toBe(200);
      expect((await post({ origin: 'https://evil.example' })).status).toBe(403);
    } finally {
      await close();
    }
  });
  // Loopback, and a port from the environment. Both are defaults a
  // deployment inherits without naming them, which is exactly why they are
  // asserted: an unauthenticated endpoint bound to a routable address by
  // default is a mistake nobody would make on purpose.
  it('binds loopback and reads PORT when neither is given', async () => {
    const before = process.env.PORT;
    process.env.PORT = '0';
    try {
      const { server, close } = await serve();
      const address = server.address();
      expect(typeof address === 'object' && address?.address).toBe('127.0.0.1');
      await close();
    } finally {
      if (before === undefined) delete process.env.PORT;
      else process.env.PORT = before;
    }
  });

  // The flag `serve-http.ts` takes from argv, and the trap it used to be. A
  // non-loopback bind left the loopback allowlist in place, so the socket
  // came up and then refused every request that reached it with a 403 naming
  // a header the operator never set. A server that serves nothing
  // convincingly is worse than one that will not start.
  it('refuses a non-loopback bind rather than 403ing everything', () => {
    expect(() => serve({ port: 0, host: '0.0.0.0' })).toThrow(/allowedHosts/);
  });

  it('binds a named host once told which names it answers to', async () => {
    const { server, close } = await serve({
      port: 0,
      host: '0.0.0.0',
      allowedHosts: ['mcp.example'],
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    // `node:http` rather than `fetch`, which sets Host from the URL and
    // discards an override - so a fetch-based test of a Host guard can only
    // ever prove that 127.0.0.1 is not in the list.
    const withHost = (host: string) =>
      new Promise<number>((resolve, reject) => {
        const req = request(
          {
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/',
            headers: {
              host,
              'content-type': 'application/json',
              accept: 'application/json, text/event-stream',
              'mcp-protocol-version': VERSION,
            },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          },
        );
        req.on('error', reject);
        req.end(
          JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        );
      });

    try {
      expect(await withHost('mcp.example')).toBe(200);
      // And the guard is still a guard: a name it was not given is refused.
      expect(await withHost('evil.example')).toBe(403);
    } finally {
      await close();
    }
  });
});

describe('the body cap', () => {
  // Resolve with what the server actually said, and fail on anything else.
  // This helper used to report *any* socket error as a 413, on the reasoning
  // that a refusal cuts the socket while the client is still writing. It does
  // - but so does every other failure, and the assertion could no longer tell
  // them apart: the declared-length guard was deleted outright and this test
  // still passed. `status` is kept so an error arriving *after* the status
  // line, which is the destroy that follows a refusal, is the harmless thing
  // it is rather than a failure.
  const post = (port: number, headers: Record<string, string>, body: string) =>
    new Promise<number>((resolve, reject) => {
      let status: number | undefined;
      const req = request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': VERSION,
            ...headers,
          },
        },
        (res) => {
          res.resume();
          status = res.statusCode ?? 0;
          resolve(status);
        },
      );
      req.on('error', (error) =>
        status === undefined ? reject(error) : resolve(status),
      );
      req.end(body);
    });

  // A declared length is refused on the header alone, before a byte of body is
  // read - which is the whole point of the cap, the tools' own item refusal
  // being downstream of parsing. So this sends the header and one token byte,
  // never the megabytes it claims: the server answers before the body it is
  // refusing could arrive, so the status line is read rather than raced
  // against the socket being cut.
  const declared = (port: number, length: number) =>
    new Promise<number>((resolve, reject) => {
      let status: number | undefined;
      const req = request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': VERSION,
            'content-length': String(length),
          },
        },
        (res) => {
          res.resume();
          status = res.statusCode ?? 0;
          resolve(status);
        },
      );
      req.on('error', (error) =>
        status === undefined ? reject(error) : resolve(status),
      );
      req.write('{');
    });

  // Chunked declares nothing, so the only bound is what has been read so far.
  // That arm cuts the connection and says nothing at all - writing a status
  // after the adapter has begun its own response throws ERR_HTTP_HEADERS_SENT
  // out of a promise nothing awaits - so the refusal here is "destroyed, and
  // no status". Asserted as that rather than as a 413, which is precisely what
  // it is not.
  const chunked = (port: number) =>
    new Promise<number | 'destroyed'>((resolve) => {
      let status: number | undefined;
      const req = request(
        {
          host: '127.0.0.1',
          port,
          method: 'POST',
          path: '/',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'transfer-encoding': 'chunked',
          },
        },
        (res) => {
          res.resume();
          status = res.statusCode ?? 0;
          resolve(status);
        },
      );
      req.on('error', () => resolve(status ?? 'destroyed'));
      for (let i = 0; i < 4; i++) req.write('x'.repeat(512 * 1024));
      req.end();
    });

  // Downstream of this the tools refuse a 501st node - but that refusal comes
  // after parsing, so without a cap here a 256 MB body is read and parsed
  // before anything counts anything.
  it('refuses an oversized body, declared or not', async () => {
    const { server, close } = await serve({ port: 0, host: '127.0.0.1' });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      // Declared: a status line, read off the wire.
      expect(await declared(port, 2 * 1024 * 1024)).toBe(413);
      // Undeclared: the connection goes, and nothing is said.
      expect(await chunked(port)).toBe('destroyed');
      // And a body that fits still goes through, so the cap is a cap and not
      // a wall.
      expect(
        await post(
          port,
          {},
          JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        ),
      ).toBe(200);
    } finally {
      await close();
    }
  });
});

describe('what an operator is told when something goes wrong', () => {
  // `onerror` is the only sink there is. Without it a content-type rejection,
  // an unsupported protocol version and a factory throw all reach the caller
  // as a bare `-32603 Internal server error` and reach the operator as
  // nothing at all - the response is byte-identical either way.
  it('reports an out-of-band error rather than swallowing it', async () => {
    const seen: string[] = [];
    const { server, close } = await serve({
      port: 0,
      host: '127.0.0.1',
      onerror: (error) => seen.push(error.message),
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      const refused = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      });

      expect(refused.status).toBeGreaterThanOrEqual(400);
      expect(seen.length).toBeGreaterThan(0);
    } finally {
      await close();
    }
  });

  // And the default sink is stderr, never stdout: stdout is a JSON-RPC stream
  // under the other transport, and one habit must not cross over.
  it('writes to stderr by default, never stdout', async () => {
    const err = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const out = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const { server, close } = await serve({ port: 0, host: '127.0.0.1' });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      await fetch(`http://127.0.0.1:${port}/`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'not json',
      });
      expect(err).toHaveBeenCalled();
      expect(out).not.toHaveBeenCalled();
    } finally {
      await close();
      err.mockRestore();
      out.mockRestore();
    }
  });
});

describe('the guarded handler', () => {
  // The shape the README shows a Worker deployment, and the reason it does
  // rather than showing the bare one: `createHandler` is validation-free by
  // design - the SDK says so of its own entry - which is right behind
  // something that validates and wrong as the example a reader copies.
  it('turns away a foreign host and origin before any tool runs', async () => {
    const { fetch: guarded } = createGuardedHandler();
    const at = (headers: Record<string, string>) =>
      guarded(
        new Request('http://evil.example/', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': VERSION,
            ...headers,
          },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
        }),
      );

    // A `Request` built here carries no Host of its own, where one built by a
    // real runtime from a real socket does. Set it explicitly, or this tests
    // the guard's missing-header branch rather than its allowlist.
    expect((await at({ host: 'evil.example' })).status).toBe(403);
    expect(
      (await at({ host: '127.0.0.1', origin: 'https://evil.example' })).status,
    ).toBe(403);
    expect((await at({ host: '127.0.0.1' })).status).toBe(200);
  });

  // The bare handler is what the guarded one wraps, and the contrast is the
  // whole point: it answers a request naming any host at all.
  it('is what the bare handler is not', async () => {
    const { fetch: bare } = createHandler();
    const answered = await bare(
      new Request('http://evil.example/', {
        method: 'POST',
        headers: {
          host: 'evil.example',
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': VERSION,
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    expect(answered.status).toBe(200);
  });
});

describe('a bind that fails', () => {
  it('closes the handler it had already built', async () => {
    const first = await serve({ port: 0, host: '127.0.0.1' });
    const address = first.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      await expect(serve({ port, host: '127.0.0.1' })).rejects.toThrow(
        /EADDRINUSE/,
      );
    } finally {
      await first.close();
    }
  });
});

describe('the transport file', () => {
  const src = (name: string) =>
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', name),
      'utf8',
    );

  // The rule `stdio.ts` already holds, and the second attempt at asserting it.
  //
  // The first was a denylist of strings this file must not contain, which is
  // theatre: a reviewer added a function to `http.ts` that reached into a
  // node's `w`, `h` and `lines` and branched on `braces`, `hops` and `depth`
  // - exactly the coupling the rule forbids - and every one of those words
  // was missing from the list, so it stayed green.
  //
  // A denylist can only name what someone thought of. What the rule actually
  // says is that this file knows the factory and the transport and nothing
  // below them, and that is a statement about its imports.
  it('imports the factory and nothing under it', () => {
    const imports = [...src('http.ts').matchAll(/from '([^']+)'/g)].map(
      ([, from]) => from,
    );

    expect(imports.sort()).toEqual([
      './factory',
      '@modelcontextprotocol/server',
    ]);
    // `./factory` is the factory. Anything reaching past it - the tools, the
    // resources, core, the rasterizer - is the rule being broken.
    for (const from of imports)
      expect(from).not.toMatch(/tools|resources|render|@pensketch/);
  });

  // The stronger half of the same rule, and the one an edge runtime cares
  // about: this file reaches no Node built-in, directly or otherwise. Asserted
  // on the import list because that is where it can be read; `npm run edge`
  // asserts it on the bundled graph, which is where it is actually true.
  it('names no Node built-in', () => {
    for (const from of [...src('http.ts').matchAll(/from '([^']+)'/g)].map(
      ([, f]) => f,
    ))
      expect(from).not.toMatch(/^node:/);
  });

  // The socket half, which is allowed everything the other half is not.
  it('keeps the listener and its Node imports in serve.ts', () => {
    const imports = [...src('serve.ts').matchAll(/from '([^']+)'/g)].map(
      ([, from]) => from,
    );
    expect(imports.sort()).toEqual([
      './http',
      '@modelcontextprotocol/node',
      'node:http',
    ]);
  });

  // What `http.ts` is allowed to know about what it serves, which is now
  // nothing at all.
  //
  // It used to be one thing - `raster: false` - and that flag was the bug. A
  // module holding it still imported the module it was switching off, so the
  // rasterizer stayed in the graph of every entry that imported the tools, and
  // no edge runtime could load any of them. The tool set is decided by which
  // factory a transport calls, so there is no flag left to widen.
  it('knows nothing about what it serves', () => {
    const body = src('http.ts')
      .split('\n')
      .filter((l) => !/^\s*(\*|\/\/)/.test(l))
      .join('\n');

    expect(body).not.toContain('raster');
    for (const name of [
      'check_diagram',
      'get_schema',
      'render_diagram',
      'render_png',
    ])
      expect(body).not.toContain(name);
  });
});
