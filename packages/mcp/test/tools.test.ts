import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createServer } from '../src/index';
import { MAX_SCALE, renderPng } from '../src/render';
import { TRAPS } from '../src/tools';

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
    {
      id: 'gate',
      shape: 'diamond',
      x: 260,
      y: 35,
      w: 150,
      h: 80,
      lines: ['allowed?'],
    },
  ],
  edges: [{ from: ['in', 'r'], to: ['gate', 'l'] }],
};
const VIEW_BOX = [0, 0, 460, 150] as [number, number, number, number];

// The SDK exposes registered tools through the server it built. Reaching for
// them this way rather than through a transport is the point of keeping the
// factory separate: everything below runs with no process to talk to.
//
// `handler`, not `callback` - one more place the 2.x layout differs from the
// 1.x one every example still shows.
const toolsOf = (server: ReturnType<typeof createServer>) =>
  (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools;

const callTool = async (name: string, args: unknown) => {
  const tool = toolsOf(createServer())[name] as {
    handler: (
      args: unknown,
      extra: unknown,
    ) => Promise<{
      isError?: boolean;
      content: { type: string; text?: string; data?: string }[];
    }>;
  };
  return tool.handler(args, {});
};

describe('the tool surface', () => {
  it('registers exactly the three documented tools', () => {
    expect(Object.keys(toolsOf(createServer())).sort()).toEqual([
      'check_diagram',
      'render_diagram',
      'render_png',
    ]);
  });
});

describe('check_diagram', () => {
  it('reports findings with their counts', async () => {
    const result = await callTool('check_diagram', {
      diagram: {
        nodes: [
          { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
          { id: 'b', shape: 'box', x: 40, y: 10, w: 100, h: 40 },
        ],
      },
    });
    expect(result.content[0]?.text).toContain('1 error');
    expect(result.content[0]?.text).toContain('node-overlap');
  });

  it('counts in the plural when there is more than one of a kind', async () => {
    const result = await callTool('check_diagram', {
      diagram: {
        nodes: [
          { id: 'a', shape: 'box', x: 0, y: 0, w: 100, h: 40 },
          { id: 'b', shape: 'box', x: 40, y: 10, w: 100, h: 40 },
          { id: 'c', shape: 'box', x: 60, y: 20, w: 100, h: 40 },
        ],
      },
    });
    expect(result.content[0]?.text).toMatch(/^3 errors, 3 warnings/);
  });

  it('says so plainly when there is nothing to report', async () => {
    const result = await callTool('check_diagram', { diagram: FLOW });
    expect(result.content[0]?.text).toBe('No findings.');
  });

  // Two things at once, both of which a caller depends on: the frame reaches
  // the checker, so out-of-bounds can run at all, and a finding resting on
  // the width estimate says so - it is a strong suspicion, not a fact, and a
  // caller weighing whether to move a box should know which it has.
  it('passes the frame through, and marks an estimated finding', async () => {
    const result = await callTool('check_diagram', {
      diagram: {
        nodes: [
          {
            id: 'wordy',
            shape: 'box',
            x: 0,
            y: 0,
            w: 40,
            h: 40,
            lines: ['far too wide for this'],
          },
          { id: 'gone', shape: 'box', x: 900, y: 0, w: 100, h: 40 },
        ],
        // Wired together so the only findings are the two under test.
        edges: [{ from: ['wordy', 'r'], to: ['gone', 'l'] }],
      },
      viewBox: [0, 0, 460, 150],
    });
    const text = result.content[0]?.text ?? '';
    expect(text).toMatch(/^1 error, 1 warning\n/);
    expect(text).toContain('out-of-bounds');
    expect(text).toContain('text-overflow');
    expect(text).toContain('[estimated]');
  });

  // The error a caller is most likely to hit, and the one `draw` throws with
  // a message naming the fix. It has to reach them, not the process log.
  it('hands back what core threw rather than failing silently', async () => {
    const result = await callTool('check_diagram', {
      diagram: { nodes: 'no' },
    });
    expect(result.isError).toBe(true);
  });
});

describe('render_diagram', () => {
  it('returns a complete svg naming the handwriting stack', async () => {
    const result = await callTool('render_diagram', {
      diagram: FLOW,
      viewBox: VIEW_BOX,
      seed: 7,
    });
    const svg = result.content[0]?.text ?? '';
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(
      true,
    );
    expect(svg).toContain('viewBox="0 0 460 150"');
    expect(svg).toContain('Chalkboard SE');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('draws the same bytes for the same seed, and different for another', async () => {
    const at = async (seed: number) =>
      (
        await callTool('render_diagram', {
          diagram: FLOW,
          viewBox: VIEW_BOX,
          seed,
        })
      ).content[0]?.text;
    expect(await at(7)).toBe(await at(7));
    expect(await at(7)).not.toBe(await at(8));
  });

  // `draw` throws with a message naming the ids that do exist. That message
  // is the whole diagnostic for a caller who cannot see the picture, so it
  // has to come back as tool output rather than as a stack trace.
  it('returns the renderer error when a diagram cannot be drawn', async () => {
    const result = await callTool('render_diagram', {
      diagram: {
        nodes: [{ id: 'a', shape: 'box', x: 0, y: 0, w: 10, h: 10 }],
        edges: [{ from: ['a', 'r'], to: ['ghost', 'l'] }],
      },
      viewBox: VIEW_BOX,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('unknown node "ghost"');
  });

  it('escapes an accessible name rather than breaking the document', async () => {
    const result = await callTool('render_diagram', {
      diagram: FLOW,
      viewBox: VIEW_BOX,
      label: 'fish & <chips>',
    });
    expect(result.content[0]?.text).toContain(
      'aria-label="fish &amp; &lt;chips&gt;"',
    );
  });
});

describe('render_png', () => {
  it('returns a png a client can display', async () => {
    const result = await callTool('render_png', {
      diagram: FLOW,
      viewBox: VIEW_BOX,
    });
    const png = Buffer.from(result.content[0]?.data ?? '', 'base64');
    expect(result.content[0]?.type).toBe('image');
    // The PNG signature, so this is an image rather than a hopeful string.
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it('rasterizes the same bytes twice', async () => {
    const args = { diagram: FLOW, viewBox: VIEW_BOX, seed: 7 };
    const once = await callTool('render_png', args);
    const twice = await callTool('render_png', args);
    expect(once.content[0]?.data).toBe(twice.content[0]?.data);
  });

  it('refuses an oversized request instead of serving it', async () => {
    const result = await callTool('render_png', {
      diagram: FLOW,
      viewBox: [0, 0, 4000, 200],
      scale: 4,
    });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('over the 4096px limit');
  });

  it('refuses a scale outside the documented range', async () => {
    await expect(
      renderPng('<svg xmlns="http://www.w3.org/2000/svg"/>', {
        width: 10,
        height: 10,
        scale: MAX_SCALE + 1,
      }),
    ).rejects.toThrow('scale must be between 1 and 4');
  });
});

describe('the tool descriptions', () => {
  const descriptions = () =>
    Object.values(
      toolsOf(createServer()) as Record<string, { description?: string }>,
    ).map((t) => t.description ?? '');

  // A description is the only documentation an agent is guaranteed to have
  // read, so the traps live there. Asserted because a description nobody
  // checks is a description that rots.
  it('carries the traps a caller cannot discover from a type', () => {
    const all = descriptions().join(' ');
    expect(all).toContain(TRAPS.coordinates);
    expect(all).toContain(TRAPS.text);
    expect(all).toContain(TRAPS.font);
  });

  it('tells the caller which tool owns questions of fit', () => {
    const png = (
      toolsOf(createServer()) as Record<string, { description?: string }>
    ).render_png?.description;
    expect(png).toContain('check_diagram');
  });
});

// In the spirit of core's determinism test: read the source rather than trust
// a review. A tool that fetched a URL or opened a path a caller named would
// make every guarantee in the README conditional on where it was running.
describe('the tools are pure', () => {
  const SRC = join(import.meta.dirname, '..', 'src');
  const sources = readdirSync(SRC)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(join(SRC, f), 'utf8')] as const);

  it.each(['tools.ts', 'index.ts'])(
    '%s reaches nothing outside itself',
    (file) => {
      const source = sources.find(([name]) => name === file)?.[1] ?? '';
      for (const forbidden of [
        'node:fs',
        'node:net',
        'node:child_process',
        'fetch(',
        'require(',
      ])
        expect(source).not.toContain(forbidden);
    },
  );

  // `render.ts` is the exception, and a narrow one: it loads the WebAssembly
  // binary and the font, both the package's own, resolved by specifier rather
  // than by any path a caller can influence, and both before any tool runs.
  it('reads only its own two files, by specifier', () => {
    const render = sources.find(([name]) => name === 'render.ts')?.[1] ?? '';
    expect(render).toContain(
      "require.resolve('@resvg/resvg-wasm/index_bg.wasm')",
    );
    expect(render).not.toContain('fetch(');
    // Every read is of a URL built here, never of an argument.
    expect(render.match(/readFileSync\(/g)).toHaveLength(2);
  });
});
