// @vitest-environment node

// Rendered where there is no DOM at all, so a component that reached for one
// while rendering would throw rather than quietly work under jsdom.

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PenSketch } from '../src/index';
import { FLOW, VIEW_BOX } from './fixtures';

describe('server rendering', () => {
  it('runs where there is no document', () => {
    expect(typeof document).toBe('undefined');
  });

  it('returns an empty svg element and does not throw', () => {
    const html = renderToString(
      <PenSketch
        aria-label="Request flow"
        diagram={FLOW}
        seed={7}
        viewBox={VIEW_BOX}
      />,
    );

    // Empty: the diagram arrives on the client, after hydration, so the
    // markup the server sends and the markup the client hydrates agree.
    expect(html).toMatch(/^<svg[^>]*><\/svg>$/);
    expect(html).toContain(`viewBox="${VIEW_BOX}"`);
    expect(html).toContain('aria-label="Request flow"');
  });
});
