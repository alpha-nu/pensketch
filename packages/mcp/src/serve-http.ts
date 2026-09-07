#!/usr/bin/env node
import { serve } from './http';

// The bin, and nothing else. Everything worth testing is in `http.ts`,
// reachable through `createHandler()` without a socket to talk to — the
// separation `index.ts` and `stdio.ts` already keep.
const port = Number(process.argv[2] ?? process.env.PORT ?? 3000);
const host = process.argv[3] ?? process.env.HOST ?? '127.0.0.1';

serve({ port, host }).then(
  // stdout is a JSON-RPC stream under the other transport and a log here, so
  // this line goes to stderr regardless: one habit, and no chance of the
  // wrong one being copied into `stdio.ts`.
  () => {
    process.stderr.write(
      `pensketch mcp listening on http://${host}:${port} (svg only; render_png is stdio)\n`,
    );
  },
  (error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  },
);
