import { createGuardedHandler } from 'npm:@pensketch/mcp@0.9.0/http';

// The Deno Deploy entrypoint: `deno serve` and Deno Deploy both take a default
// export with a `fetch` on it, which is the shape `createGuardedHandler`
// returns.
//
// It imports the *published* package rather than the workspace, so what runs
// here is what an npm consumer gets. The version is therefore a pin, and pins
// go stale: `npm run pin` rewrites it from the manifest during `npm run bump`,
// and CI's tree-clean assertion fails if a release leaves it behind. Do not
// drop the version to track latest - a deployment whose behaviour depends on
// when it happened to build is the thing that gate exists to prevent.
//
// `render_png` is absent here and cannot be added: the rasterizer loads its
// WebAssembly off a filesystem this runtime does not have. Stdio is the
// transport that draws pictures.

/**
 * The hostnames this deployment answers to, comma-separated.
 *
 * Bare hostnames: no scheme, no port, no path. The SDK reduces both headers to
 * a hostname before comparing — `Host` by parsing `http://<header>`, which
 * drops any port, and `Origin` by parsing it as a URL, which drops the scheme.
 * So `pensketch.acme.deno.net`, not `https://pensketch.acme.deno.net:443`.
 *
 * On Deno Deploy that is `<app>.<org>.deno.net`, plus any custom domain. The
 * `.deno.dev` form belongs to Deploy Classic, which shut down on 2026-07-20.
 *
 * Required, with no default, and that is deliberate. The guard answers 403 to
 * a name it was not given, so a wrong value here refuses every request that
 * arrives — a server that looks broken rather than misconfigured, with nothing
 * in the log to say which. A guessed default is the most likely wrong value
 * there is: the first draft of this file defaulted to a `.deno.dev` hostname,
 * which would have refused every request to the platform it was written for.
 * Failing at boot names the fix instead.
 *
 * A request carrying no `Origin` at all is allowed through by the SDK, which
 * is what an MCP client that is not a browser sends.
 */
const hosts = (Deno.env.get('ALLOWED_HOSTS') ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

if (!hosts.length)
  throw new Error(
    'ALLOWED_HOSTS is unset. Set it in the Deno Deploy console, under the app\'s environment variables in the Production context, to the hostnames this deployment answers on - `<app>.<org>.deno.net` and any custom domain, comma-separated, as bare hostnames. Without it every request is refused 403 for naming a host the rebinding guard was not given.',
  );

export default createGuardedHandler({ allowedHosts: hosts });
