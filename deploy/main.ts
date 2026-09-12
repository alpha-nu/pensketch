import { createGuardedHandler } from 'npm:@pensketch/mcp@0.8.0/http';

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
 * The hostnames this deployment answers to.
 *
 * Not decoration. A browser will send a cross-origin request to any host on
 * behalf of whatever page the user has open, so the guard checks `Host` and
 * `Origin` on every request and answers 403 to a name it was not given. That
 * means this list is also the most likely way to break the deployment: left
 * naming localhost, every request from Deno Deploy is refused, and the symptom
 * is a server that looks broken rather than misconfigured.
 */
const HOSTS = (Deno.env.get('ALLOWED_HOSTS') ?? 'pensketch.deno.dev')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

export default createGuardedHandler({ allowedHosts: HOSTS });
