// Testing Library unmounts what it mounted only when it can register its own
// `afterEach` hook, which needs `afterEach` to be a global - and this suite
// does not enable globals. Without this file every mounted tree would still be
// in the document while the next case runs.

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
