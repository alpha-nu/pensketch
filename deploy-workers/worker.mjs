import { createGuardedHandler } from '@pensketch/mcp/http';

// The Workers spelling of the retired deploy/main.ts: the same guarded
// handler from the *published* @pensketch/mcp, with the allowed hostnames
// read from the Worker's env binding instead of Deno.env.
//
// Built on the first request rather than at module top level because a
// Worker has no env at import time - bindings arrive with each request -
// and reused for every request after.
let handler;

export default {
  fetch(request, env, ctx) {
    handler ??= createGuardedHandler({
      allowedHosts: (env.ALLOWED_HOSTS ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      // `wrangler tail` is the only window into a deployed Worker, and
      // without a sink the handler is deliberately silent - http.ts calls
      // this callback the difference between a diagnosable server and a
      // silent one.
      onerror: (error) => console.error(error),
    });
    return handler.fetch(request, env, ctx);
  },
};
