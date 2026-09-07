#!/usr/bin/env node

// The bin, and it has to be exactly one of them.
//
// `npx @pensketch/mcp` runs a package's *only* bin without being told its
// name, which is what every published install line does and what sits in
// every existing client config. A second bin makes that command ambiguous and
// npm refuses it outright - `could not determine executable to run` - so
// shipping the HTTP transport as `pensketch-mcp-http` would have broken every
// one of those configs on upgrade. Verified against a packed tarball, which
// is the only way to find it: nothing in a workspace exercises `npx`.
//
// So it is a subcommand. `pensketch-mcp` is stdio, exactly as it was;
// `pensketch-mcp http [port] [host]` listens.
//
// Both transports are loaded dynamically, so the stdio path does not pay to
// resolve the HTTP adapter and the HTTP path does not pay for the stdio one.

const [mode, ...rest] = process.argv.slice(2);

const failed = (error: unknown) => {
  // stderr, never stdout: stdout is a JSON-RPC stream on the other branch of
  // this very file, and one habit must not cross over.
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
};

if (mode === 'http') {
  void import('./http')
    .then(({ serve }) => {
      const port = Number(rest[0] ?? process.env.PORT ?? 3000);
      const host = rest[1] ?? process.env.HOST ?? '127.0.0.1';
      // The bin's way to bind something other than loopback. Without it
      // `serve` refuses, which is correct and would leave the bin unable to
      // do the one deployment the README describes.
      const allowed = (process.env.ALLOWED_HOSTS ?? '')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

      return serve({
        port,
        host,
        ...(allowed.length ? { allowedHosts: allowed } : {}),
      }).then(() => {
        process.stderr.write(
          `pensketch mcp listening on http://${host}:${port} (svg only; render_png is stdio)\n`,
        );
      });
    })
    .catch(failed);
} else {
  void Promise.all([
    import('@modelcontextprotocol/server/stdio'),
    import('./index'),
  ])
    .then(([{ serveStdio }, { createServer }]) => {
      serveStdio(() => createServer());
    })
    .catch(failed);
}
