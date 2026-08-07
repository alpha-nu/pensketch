#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { createServer } from './index';

// The transport, and nothing else. `serveStdio` takes a factory rather than a
// server, which is the same separation this file exists to keep: everything
// worth testing is in `index.ts`, reachable without a process to talk to.
serveStdio(() => createServer());
