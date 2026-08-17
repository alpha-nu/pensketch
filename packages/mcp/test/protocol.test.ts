import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createServer } from '../src/index';
import { svgFor } from '../src/tools';

// The factory with a transport attached, but not a process: the SDK's
// in-memory pair speaks the same protocol over a pipe in this test. What it
// proves is the wiring - that a client asking for the tool list gets the
// three tools, and that calling one returns content rather than an error
// shaped like content. That the *binary* starts and talks over stdin is a
// different claim, proved by spawning it in `npm run stdio`.

/** Only what a JSON-RPC reply has to have for these to read it. */
interface Reply {
  id?: number;
  result?: Record<string, unknown>;
}

/** A transport that takes whatever the protocol calls a message. */
type Loose = {
  send(message: unknown): Promise<void>;
  onmessage?: (message: Reply) => void;
};

/** A client that only knows how to ask, which is all this needs. */
const connected = async () => {
  const [client, serverSide] = InMemoryTransport.createLinkedPair();
  const clientSide = client as unknown as Loose;
  await createServer().connect(serverSide);

  let id = 0;
  const send = (method: string, params?: unknown) =>
    new Promise<Reply>((resolve) => {
      const request = { jsonrpc: '2.0' as const, id: ++id, method, params };
      clientSide.onmessage = (message) => {
        if (message.id === request.id) resolve(message);
      };
      void clientSide.send(request);
    });

  await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  await clientSide.send({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  return { send };
};

describe('a client talking to the server', () => {
  it('completes an initialize handshake naming the package', async () => {
    const [client, serverSide] = InMemoryTransport.createLinkedPair();
    const clientSide = client as unknown as Loose;
    await createServer().connect(serverSide);
    const reply = await new Promise<Reply>((resolve) => {
      clientSide.onmessage = resolve;
      void clientSide.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '0' },
        },
      });
    });
    const info = reply.result?.serverInfo as { name: string; version: string };
    expect(info.name).toBe('pensketch');
    expect(info.version).toBe(__MCP_VERSION__);
  });

  it('lists the three tools with their descriptions', async () => {
    const { send } = await connected();
    const { result } = await send('tools/list');
    const tools = result?.tools as {
      name: string;
      description?: string;
      inputSchema?: {
        additionalProperties?: boolean;
        properties?: { diagram?: { additionalProperties?: boolean } };
      };
    }[];
    expect(tools.map((t) => t.name).sort()).toEqual([
      'check_diagram',
      'render_diagram',
      'render_png',
    ]);
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      // The schema a client validates against says what the server does.
      // These two are the published half of the strict boundary: without
      // them a caller's own validator waves through a key the server is
      // about to refuse, and the caller learns about it from an error rather
      // than from the contract it was handed.
      expect(tool.inputSchema?.additionalProperties).toBe(false);
      expect(tool.inputSchema?.properties?.diagram?.additionalProperties).toBe(
        false,
      );
    }
  });

  // A tool schema is what an agent reads before it reads any resource, so this
  // parameter has to teach the whole feature on its own: what comes back, that
  // it needs nothing else, and what a viewer that cannot animate it shows
  // instead. Asserted for the same reason the traps are - a description nobody
  // checks is a description that rots.
  it('teaches the animate parameter in the schema itself', async () => {
    const { send } = await connected();
    const { result } = await send('tools/list');
    const tools = result?.tools as {
      name: string;
      inputSchema?: { properties?: Record<string, { description?: string }> };
    }[];
    const animate =
      tools.find((t) => t.name === 'render_diagram')?.inputSchema?.properties
        ?.animate?.description ?? '';

    expect(animate).toContain('draws itself');
    expect(animate).toContain('complete on its own');
    expect(animate).toContain('no CSS to write');
    expect(animate).toContain('@scope');
    expect(animate).toContain('finished and static rather than blank');
    // And the raster publishes no such parameter to read in the first place.
    expect(
      tools.find((t) => t.name === 'render_png')?.inputSchema?.properties
        ?.animate,
    ).toBeUndefined();
  });

  it('lists every resource', async () => {
    const { send } = await connected();
    const { result } = await send('resources/list');
    const resources = result?.resources as { uri: string }[];
    expect(resources.map((r) => r.uri).sort()).toEqual([
      'pensketch://constants',
      'pensketch://example/atm',
      'pensketch://example/incident',
      'pensketch://example/lifecycle',
      'pensketch://example/pipeline',
      'pensketch://example/showcase',
      'pensketch://schema',
      'pensketch://spec',
    ]);
  });

  it('calls a tool and gets a real answer back', async () => {
    const { send } = await connected();
    const { result } = await send('tools/call', {
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
    expect(result?.isError).toBeFalsy();
    const content = result?.content as { text: string }[];
    expect(content[0]?.text).toContain('node-overlap');
  });

  it('reads a resource and gets the file it mirrors', async () => {
    const { send } = await connected();
    const { result } = await send('resources/read', {
      uri: 'pensketch://schema',
    });
    const contents = result?.contents as { text: string }[];
    expect(JSON.parse(contents[0]?.text ?? '{}').title).toBe(
      'Pensketch diagram',
    );
  });
});

/** A tool call the way a client makes it, answer and all. */
const called = async (name: string, args: Record<string, unknown>) => {
  const { send } = await connected();
  const { result } = await send('tools/call', { name, arguments: args });
  return (result ?? {}) as { isError?: boolean; content?: { text: string }[] };
};

/** The text of a refusal, having insisted it was one. */
const refusal = async (name: string, args: Record<string, unknown>) => {
  const result = await called(name, args);
  expect(result.isError).toBe(true);
  return result.content?.[0]?.text ?? '';
};

const NODE = { id: 'a', shape: 'box', x: 10, y: 10, w: 100, h: 40 };
const BOX = [0, 0, 260, 100] as [number, number, number, number];

// These belong here rather than in `tools.test.ts`, and the distinction is
// the whole point: that file reaches a handler directly, which is past where
// the input schema is consulted, so a key it sent would arrive whatever the
// schema said. The SDK validates the arguments of a call that crosses a
// transport - so only a call that crosses one can prove a key is refused.
//
// 0.1.1 stripped these instead. A diagram reached the renderer short a piece,
// nothing in the reply said so, and a caller who cannot see the picture had
// no way to find out.
describe('the tool boundary refuses what it cannot carry', () => {
  // `braces` until this change added it, which is the point rather than an
  // inconvenience: the key an agent invents is whichever one the data model
  // has not got yet, and this test has to keep naming one of those.
  it('names an unrecognised top-level key rather than dropping it', async () => {
    const text = await refusal('render_diagram', {
      diagram: { nodes: [NODE], legend: [{ x: 0, y: 0 }] },
      viewBox: BOX,
    });
    expect(text).toContain('"legend"');
  });

  // The common case, and the one that used to render an empty picture and
  // report no problem: the key is quoted, so the caller reads back what they
  // typed rather than what they meant.
  it('names a misspelled field rather than drawing an empty diagram', async () => {
    const text = await refusal('check_diagram', { diagram: { node: [NODE] } });
    expect(text).toContain('"node"');
  });

  // Quoting the key back is not a diagnostic - the key came from the caller.
  // Every assertion above would pass on a message that echoed the arguments
  // and said nothing, which is what an earlier draft of these tests allowed.
  // A refusal has to carry the fix, which for this caller means the fields it
  // should have used and where the rest are written down.
  it('tells the caller what to send instead, not only what was wrong', async () => {
    const text = await refusal('check_diagram', { diagram: { node: [NODE] } });
    expect(text).toContain('It takes nodes, edges, braces and notes');
    expect(text).toContain('pensketch://schema');
    // The echo it must not be: an argument dump would carry the node's own
    // fields along with the offending key.
    expect(text).not.toContain('"shape"');
  });

  // `hops` is a rendering concern, so the two rendering tools take it and the
  // checker does not. Left undeclared there, the strict boundary refuses it by
  // name - which tells a caller that hops are not something `check` models,
  // where accepting it and returning findings computed as though it had been
  // applied would tell them the opposite.
  it('refuses hops on check_diagram, which does not model them', async () => {
    const text = await refusal('check_diagram', {
      diagram: { nodes: [NODE] },
      hops: true,
    });
    expect(text).toContain('"hops"');
  });

  it('takes hops on the tools that render', async () => {
    for (const name of ['render_diagram', 'render_png']) {
      const result = await called(name, {
        diagram: { nodes: [NODE] },
        viewBox: BOX,
        hops: true,
      });
      expect(result.isError, `${name} refused hops`).toBeFalsy();
    }
  });

  // A raster is one frame, and the field is left out of `render_png` on
  // purpose. The strict boundary is what turns that absence into a refusal by
  // name: declared and ignored, it would hand back a still image as though the
  // request had been honoured, and a caller who cannot see the picture has no
  // way to tell those two apart.
  it('refuses animate on render_png, which cannot carry it', async () => {
    const text = await refusal('render_png', {
      diagram: { nodes: [NODE] },
      viewBox: BOX,
      animate: true,
    });
    expect(text).toContain('render_png has no argument "animate"');
    expect(text).toContain('an optional seed, hops and scale');
  });

  it('takes animate on the tool that renders a document', async () => {
    const result = await called('render_diagram', {
      diagram: { nodes: [NODE] },
      viewBox: BOX,
      animate: true,
    });
    expect(result.isError).toBeFalsy();
    expect(result.content?.[0]?.text).toContain('@keyframes ps-draw');
  });

  // Each tool names itself and its own arguments. One shared message would
  // send a caller who mistyped `scale` off to read about diagrams.
  it('names the tool and its arguments when the stray key is an argument', async () => {
    const text = await refusal('render_png', {
      diagram: { nodes: [NODE] },
      viewBox: BOX,
      quality: 'high',
    });
    expect(text).toContain('render_png has no argument "quality"');
    expect(text).toContain('an optional seed, hops and scale');
  });

  // Plural is a different sentence, and a message assembled by concatenation
  // reads like one unless somebody looks.
  it('reads as English when more than one key is refused', async () => {
    const text = await refusal('render_diagram', {
      diagram: { nodes: [NODE], raw: [], legend: [] },
      viewBox: BOX,
    });
    expect(text).toContain('A diagram has no fields "raw", "legend".');
  });

  it('refuses `raw`, which the description says it does not accept', async () => {
    const text = await refusal('render_diagram', {
      diagram: { nodes: [NODE], raw: {} },
      viewBox: BOX,
    });
    expect(text).toContain('"raw"');
  });

  // Every tool, not one of them. The arguments beside the diagram are strict
  // too, or a caller who guessed at an option would be told nothing and get
  // the default - and a tool left loose is a tool nothing would notice.
  it.each([
    ['check_diagram', {}],
    ['render_diagram', { viewBox: BOX }],
    ['render_png', { viewBox: BOX }],
  ])("names an unknown argument beside %s's diagram", async (name, rest) => {
    const text = await refusal(name, {
      diagram: { nodes: [NODE] },
      ...rest,
      quality: 'high',
    });
    expect(text).toContain('"quality"');
  });

  // The list in `tools.ts` is hand-maintained, and the schema is generated
  // from the types. Holding one to the other is what makes a forgotten field
  // a failing test rather than a field an agent sends and never sees drawn -
  // which is precisely how the next change adds `braces`.
  it('declares the same top-level fields the published schema does', async () => {
    const { send } = await connected();
    const listed = await send('tools/list');
    const read = await send('resources/read', {
      uri: 'pensketch://schema',
    });
    const contents = (read.result?.contents ?? []) as { text: string }[];
    const schema = JSON.parse(contents[0]?.text ?? '{}');
    const tools = listed.result?.tools as {
      inputSchema?: {
        properties?: { diagram?: { properties?: Record<string, unknown> } };
      };
    }[];
    for (const tool of tools) {
      expect(
        Object.keys(tool.inputSchema?.properties?.diagram?.properties ?? {}),
      ).toEqual(Object.keys(schema.properties));
    }
  });

  // The boundary is strict at this level and no deeper, and that is a choice
  // rather than an oversight: the fields inside a member are described by
  // pensketch://schema, and restating twenty of them here would be the second
  // source of truth this file was careful not to create. Written down as a
  // test so that changing it is a decision someone makes on purpose.
  it('leaves the fields inside a member to the published schema', async () => {
    const result = await called('render_diagram', {
      diagram: { nodes: [{ ...NODE, line: ['a typo for lines'] }] },
      viewBox: BOX,
    });
    expect(result.isError).toBeFalsy();
    // Accepted, drawn, and the label the caller meant is simply absent.
    expect(result.content?.[0]?.text).not.toContain('a typo for lines');
  });

  // The other half of the claim, and the one worth more: nothing that was
  // reaching the renderer stops reaching it. A diagram using all three
  // declared keys comes back as exactly the bytes `svgFor` draws for it, so
  // the boundary is handing the data over rather than sieving it.
  it('hands every declared key to the renderer unsieved', async () => {
    const diagram = {
      nodes: [
        { id: 'a', shape: 'box', x: 10, y: 10, w: 80, h: 40, lines: ['a'] },
        { id: 'b', shape: 'box', x: 150, y: 10, w: 80, h: 40, lines: ['b'] },
      ],
      edges: [{ from: ['a', 'r'], to: ['b', 'l'] }],
      notes: [{ x: 10, y: 80, lines: ['a note'] }],
    };
    const result = await called('render_diagram', {
      diagram,
      viewBox: BOX,
      seed: 7,
    });
    expect(result.isError).toBeFalsy();
    expect(result.content?.[0]?.text).toBe(svgFor(diagram, BOX, { seed: 7 }));
  });
});
