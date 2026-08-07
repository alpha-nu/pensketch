import { describe, expect, it } from 'vitest';
import { createServer } from '../src/index';

describe('createServer', () => {
  // The factory is reachable with no transport attached, which is the whole
  // point of keeping it out of `stdio.ts`: everything worth testing can be
  // exercised without a process to talk to.
  it('builds a server without a transport', () => {
    expect(createServer()).toBeDefined();
  });

  // Clients show this to a user deciding which server answered. It comes from
  // the manifest at build time rather than a string kept in step by hand.
  it('reports the package version it was built from', () => {
    expect(__MCP_VERSION__).toMatch(/^\d+\.\d+\.\d+/);
  });
});
