import { InMemoryTransport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { createServer } from '../src/index';

// The factory with a transport attached, but not a process: the SDK's
// in-memory pair speaks the same protocol over a pipe in this test. What it
// proves is the wiring - that a client asking for the tool list gets the
// three tools, and that calling one returns content rather than an error
// shaped like content. That the *binary* starts and talks over stdin is a
// different claim, proved by spawning it in `npm run stdio`.

/** A client that only knows how to ask, which is all this needs. */
const connected = async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  await server.connect(serverSide);

  let id = 0;
  const send = (method: string, params?: unknown) =>
    new Promise<Record<string, never> & { result?: any; error?: any }>(
      (resolve) => {
        const request = { jsonrpc: '2.0' as const, id: ++id, method, params };
        clientSide.onmessage = (message: any) => {
          if (message.id === request.id) resolve(message);
        };
        void clientSide.send(request);
      },
    );

  await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  await clientSide.send({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  } as any);
  return { send };
};

describe('a client talking to the server', () => {
  it('completes an initialize handshake naming the package', async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await createServer().connect(serverSide);
    const reply = await new Promise<any>((resolve) => {
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
      } as any);
    });
    expect(reply.result.serverInfo.name).toBe('pensketch');
    expect(reply.result.serverInfo.version).toBe(__MCP_VERSION__);
  });

  it('lists the three tools with their descriptions', async () => {
    const { send } = await connected();
    const { result } = await send('tools/list');
    expect(result.tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'check_diagram',
      'render_diagram',
      'render_png',
    ]);
    for (const tool of result.tools) expect(tool.description).toBeTruthy();
  });

  it('lists every resource', async () => {
    const { send } = await connected();
    const { result } = await send('resources/list');
    expect(result.resources.map((r: { uri: string }) => r.uri).sort()).toEqual([
      'pensketch://constants',
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
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('node-overlap');
  });

  it('reads a resource and gets the file it mirrors', async () => {
    const { send } = await connected();
    const { result } = await send('resources/read', {
      uri: 'pensketch://schema',
    });
    expect(JSON.parse(result.contents[0].text).title).toBe('Pensketch diagram');
  });
});
