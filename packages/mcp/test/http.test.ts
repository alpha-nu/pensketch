import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createHandler, serve } from '../src/http';
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

/** An initialized session, since a tool call before one is refused. */
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

  it('refuses render_png as an unknown tool rather than serving it', async () => {
    const fetch = await opened();
    const { body } = await rpc(fetch, 'tools/call', {
      name: 'render_png',
      arguments: { diagram: FLOW, viewBox: VIEW_BOX },
    });

    expect(
      body.result?.content?.[0]?.text ?? body.error?.message ?? '',
    ).toMatch(/render_png/);
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
