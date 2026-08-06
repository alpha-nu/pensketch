import type { Diagram } from '../packages/core/src/types';

/**
 * The JSON-serialisable half of a `Diagram`, which is what the schema
 * describes.
 *
 * `raw` is omitted because it holds functions, and no file and no wire can
 * carry one. Generated for it, the schema models a callback as an object with
 * a `namedArgs` property — an invitation to send something that cannot work.
 * A caller reaching for the escape hatch is writing code, not data, and has
 * the types for it.
 *
 * Declared here rather than exported from the package: it exists to give the
 * generator a name to point at, and it tracks `Diagram` because it is derived
 * from it rather than copied.
 */
export type PensketchDiagram = Omit<Diagram, 'raw'>;
