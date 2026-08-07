import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createServer } from '../src/index';

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
    const tools = result?.tools as { name: string; description?: string }[];
    expect(tools.map((t) => t.name).sort()).toEqual([
      'check_diagram',
      'render_diagram',
      'render_png',
    ]);
    for (const tool of tools) expect(tool.description).toBeTruthy();
  });

  it('lists every resource', async () => {
    const { send } = await connected();
    const { result } = await send('resources/list');
    const resources = result?.resources as { uri: string }[];
    expect(resources.map((r) => r.uri).sort()).toEqual([
      'pensketch://constants',
      'pensketch://example/atm',
      'pensketch://example/lifecycle',
      'pensketch://example/oauth',
      'pensketch://example/pipeline',
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
