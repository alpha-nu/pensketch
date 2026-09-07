import { readFileSync } from 'node:fs';
import { request } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { createGuardedHandler, createHandler, serve } from '../src/http';
import { createServer } from '../src/index';
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
  it('serves check_diagram and render_diagram, and not render_png', async () => {
    const fetch = await opened();
    const { body } = await rpc(fetch, 'tools/list');

    expect((body.result?.tools ?? []).map((t) => t.name).sort()).toEqual([
      'check_diagram',
      'render_diagram',
    ]);
  });

  // The rule is absence rather than refusal. An agent pays for every tool
  // description it is sent, and one it cannot call is tokens spent plus a turn
  // it may spend finding out. Stdio keeps all three.
  it('leaves all three tools on stdio', () => {
    const all = createServer();
    const svgOnly = createServer({ raster: false });
    const names = (s: ReturnType<typeof createServer>) =>
      Object.keys(
        (s as unknown as { _registeredTools: Record<string, unknown> })
          ._registeredTools,
      ).sort();

    expect(names(all)).toEqual([
      'check_diagram',
      'render_diagram',
      'render_png',
    ]);
    expect(names(svgOnly)).toEqual(['check_diagram', 'render_diagram']);
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
  const post = (port: number, headers: Record<string, string>, body: string) =>
    new Promise<number>((resolve, reject) => {
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
          resolve(res.statusCode ?? 0);
        },
      );
      // A refusal cuts the socket while the client is still writing, so the
      // client's own view of it is EPIPE rather than a status line. Both are
      // the same event; report it as one.
      req.on('error', () => resolve(413));
      req.end(body);
    });

  // Downstream of this the tools refuse a 501st node - but that refusal comes
  // after parsing, so without a cap here a 256 MB body is read and parsed
  // before anything counts anything.
  it('refuses an oversized body, declared or not', async () => {
    const { server, close } = await serve({ port: 0, host: '127.0.0.1' });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const big = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { pad: 'x'.repeat(2 * 1024 * 1024) },
    });

    try {
      expect(await post(port, {}, big)).toBe(413);

      // And the half a declared length cannot cover: a chunked body declares
      // nothing, so the only bound is what has actually been read so far.
      const chunked = await new Promise<number>((resolve) => {
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
            resolve(res.statusCode ?? 0);
          },
        );
        req.on('error', () => resolve(413));
        for (let i = 0; i < 4; i++) req.write('x'.repeat(512 * 1024));
        req.end();
      });
      expect(chunked).toBe(413);
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

describe('the transport file', () => {
  const src = (name: string) =>
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'src', name),
      'utf8',
    );

  // The rule `stdio.ts` already holds. `raster` is the one thing this file is
  // allowed to know, and it is a fact about the transport rather than about a
  // tool: a synchronous rasterizer in a process serving many clients.
  it('names no tool, no resource and no geometry', () => {
    const http = src('http.ts');
    for (const forbidden of [
      'check_diagram',
      'render_diagram',
      'render_png',
      'viewBox',
      'nodes',
      'edges',
      'seed',
      'extrude',
      'pensketch/core',
    ])
      expect(
        http
          .split('\n')
          .filter((l) => !l.trim().startsWith('*'))
          .join('\n'),
      ).not.toContain(forbidden);
  });
});
