import { InMemoryTransport } from '@modelcontextprotocol/server';
import { constants } from '@pensketch/core';
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
  return (result ?? {}) as {
    isError?: boolean;
    // `data` as well as `text`: one of the three answers with an image, and
    // the pair has to be proved to reach that one too.
    content?: { text?: string; data?: string }[];
  };
};

/** The text of a refusal, having insisted it was one. */
const refusal = async (name: string, args: Record<string, unknown>) => {
  const result = await called(name, args);
  expect(result.isError).toBe(true);
  return result.content?.[0]?.text ?? '';
};

const NODE = { id: 'a', shape: 'box', x: 10, y: 10, w: 100, h: 40 };
const BOX = [0, 0, 260, 100] as [number, number, number, number];

// The defect the whole capability was written for, sized for this frame. Flat,
// the box ends 10 px inside it and nothing is wrong with the diagram; extruded
// at the default depth its slab reaches 262 in a 260-wide frame and the render
// clips the face. A checker handed the diagram without the pair reports the
// first picture while the caller renders the second.
const AT_EDGE = { id: 'a', shape: 'box', x: 150, y: 30, w: 100, h: 40 };

/** What a client is handed to work from: the tool list and the schema. */
interface Listed {
  name: string;
  inputSchema?: {
    properties?: Record<
      string,
      { description?: string; properties?: Record<string, unknown> }
    >;
  };
}

interface Published {
  properties: Record<string, unknown>;
  definitions?: {
    DiagramNode?: { anyOf?: { properties?: Record<string, unknown> }[] };
  };
}

const published = async (): Promise<{
  tools: Listed[];
  schema: Published;
}> => {
  const { send } = await connected();
  const listed = await send('tools/list');
  const read = await send('resources/read', { uri: 'pensketch://schema' });
  const contents = (read.result?.contents ?? []) as { text: string }[];
  return {
    tools: (listed.result?.tools ?? []) as Listed[],
    schema: JSON.parse(contents[0]?.text ?? '{}') as Published,
  };
};

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

  // The deliberate opposite of the two above, and the same reason read
  // forward: `hops` is refused by the checker because it changes no finding,
  // and the pair is taken by it because it changes the geometry every finding
  // measures. All three, so the tool a caller reaches for first is not the one
  // that makes them guess.
  it('takes the depth pair on all three tools, the checker included', async () => {
    for (const name of ['check_diagram', 'render_diagram', 'render_png']) {
      const result = await called(name, {
        diagram: { nodes: [NODE] },
        viewBox: BOX,
        extrude: true,
        depth: 16,
      });
      expect(result.isError, `${name} refused the pair`).toBeFalsy();
    }
  });

  it('measures the drawing the render will make, not the flat one', async () => {
    const raised = await called('check_diagram', {
      diagram: { nodes: [AT_EDGE] },
      viewBox: BOX,
      extrude: true,
    });
    expect(raised.isError).toBeFalsy();
    expect(raised.content?.[0]?.text).toContain('out-of-bounds');

    const flat = await called('check_diagram', {
      diagram: { nodes: [AT_EDGE] },
      viewBox: BOX,
    });
    expect(flat.content?.[0]?.text).not.toContain('out-of-bounds');
  });

  // Two claims in one: the pair reaches `draw`, and omitting `depth` is the
  // documented default rather than nothing. `constants.DEPTH` rather than the
  // number 12, because a description that promises a default has to promise
  // the one the renderer resolves.
  it('hands the pair to the renderer, at the default depth when given none', async () => {
    const diagram = { nodes: [NODE] };
    const raised = await called('render_diagram', {
      diagram,
      viewBox: BOX,
      seed: 7,
      extrude: true,
    });
    const svg = raised.content?.[0]?.text;
    expect(svg).toBe(svgFor(diagram, BOX, { seed: 7, extrude: true }));
    expect(svg).toBe(
      svgFor(diagram, BOX, { seed: 7, extrude: true, depth: constants.DEPTH }),
    );
    expect(svg).not.toBe(svgFor(diagram, BOX, { seed: 7 }));
  });

  // The raster and the document cannot be compared byte for byte - one names
  // the embedded face and resolves the palette, the other does neither - so
  // the parity that matters is that both draw the same picture for the same
  // pair. The test above pins the document to `svgFor`; this pins the raster
  // to the same two facts about that picture: the pair reached it, and with no
  // `depth` it is the drawing at `constants.DEPTH` rather than at some other
  // depth or at none.
  it('rasterizes the same drawing render_diagram returns for the pair', async () => {
    const diagram = { nodes: [{ ...NODE, y: 40 }] };
    const at = async (rest: Record<string, unknown>) =>
      (await called('render_png', { diagram, viewBox: BOX, seed: 7, ...rest }))
        .content?.[0]?.data;

    const [flat, raised, stated, deeper] = await Promise.all([
      at({}),
      at({ extrude: true }),
      at({ extrude: true, depth: constants.DEPTH }),
      at({ extrude: true, depth: constants.DEPTH * 2 }),
    ]);

    expect(raised).toBe(stated);
    expect(raised).not.toBe(flat);
    expect(raised).not.toBe(deeper);
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
    expect(text).toContain('an optional seed, hops, extrude, depth and scale');
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
    expect(text).toContain('an optional seed, hops, extrude, depth and scale');
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
    const { tools, schema } = await published();
    for (const tool of tools) {
      expect(
        Object.keys(tool.inputSchema?.properties?.diagram?.properties ?? {}),
      ).toEqual(Object.keys(schema.properties));
    }
  });

  // The same guard one level out, over the arguments beside the diagram. There
  // is no generated list to hold those to - `DrawOptions` is TypeScript and
  // nothing publishes it as data - so what they are held to is the sentence
  // every refusal ends with, which is the only place a caller is told what a
  // tool takes. Declare an argument and forget the sentence and the tool
  // accepts a key while telling the next caller it has none.
  it('names every argument it declares in the sentence it refuses with', async () => {
    const { tools } = await published();
    for (const tool of tools) {
      const text = await refusal(tool.name, {
        diagram: { nodes: [NODE] },
        viewBox: BOX,
        quality: 'high',
      });
      // The tail after `It takes `, not the whole message: two of the three
      // tools have `diagram` inside their own name, and the message opens
      // with that name.
      const takes = text.split('It takes ')[1] ?? '';
      for (const argument of Object.keys(tool.inputSchema?.properties ?? {}))
        expect(takes, `${tool.name} does not name ${argument}`).toContain(
          argument,
        );
    }
  });

  // The pair is two node fields raised to the whole diagram, so the schema is
  // what names them and this reads them off it rather than spelling them
  // again. Rename the field in the types and the schema half fails, rather
  // than three tools going on declaring a spelling nothing else uses.
  it.each(['extrude', 'depth'])(
    'declares %s on every tool, as the schema declares it on a node',
    async (field) => {
      const { tools, schema } = await published();
      const shapes = schema.definitions?.DiagramNode?.anyOf ?? [];
      expect(
        shapes.flatMap((shape) => Object.keys(shape.properties ?? {})),
      ).toContain(field);
      for (const tool of tools)
        expect(
          Object.keys(tool.inputSchema?.properties ?? {}),
          `${tool.name} does not take ${field}`,
        ).toContain(field);
    },
  );

  // `extrude`'s description promises a pill size, and that number is a second
  // copy of a formula core deliberately declines to write down: `carriesFace`
  // asks `arcPoints` for the bound instead, on the grounds that a number
  // copied out of a formula is the copy that drifts. A description cannot
  // call a function, so the copy stays - and this holds it to the renderer
  // rather than to the formula. The size it names must be one that draws
  // faces, and a hundredth under it must not, which pins the bound from both
  // sides: whichever of the two moves, the sentence an agent reads goes red
  // rather than quiet.
  it('promises a pill size the renderer actually extrudes', async () => {
    const { tools } = await published();
    const said = tools
      .map((t) => String(t.inputSchema?.properties?.extrude?.description ?? ''))
      .join(' ');
    const promised = Number(/larger dimension of ([\d.]+) px/.exec(said)?.[1]);
    expect(promised, `no pill size named in: ${said}`).toBeGreaterThan(0);

    // One px tall, so only the width can earn the third chord - the bound is
    // on the larger dimension, and this makes the width the larger one. Each
    // width is its own control, drawn twice: a wider pill writes longer
    // coordinates whether or not it extrudes, so the comparison that means
    // anything is the same pill with the switch on and off.
    const pill = async (w: number, extrude: boolean) => {
      const r = await called('render_diagram', {
        diagram: { nodes: [{ id: 'p', shape: 'pill', x: 0, y: 0, w, h: 1 }] },
        viewBox: BOX,
        extrude,
      });
      return r.content?.[0]?.text ?? '';
    };
    const carries = async (w: number) =>
      (await pill(w, true)) !== (await pill(w, false));
    expect(await carries(promised)).toBe(true);
    expect(await carries(promised - 0.01)).toBe(false);
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
