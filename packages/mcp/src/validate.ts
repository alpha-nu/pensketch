import validateGenerated from './validate.generated';

// The refusal a caller reads instead of a stack trace. Before this file
// existed, the natural first guesses at the data model - `from: "a"`,
// a node labelled `text` - reached core's geometry and came back as
// `TypeError: undefined is not iterable`, and a caller who cannot read the
// schema resource reverse-engineered the shape by crashing (measured at
// eight calls, docs/pensketch-feedback.md). The validator is precompiled
// from the same schema the `pensketch://schema` resource serves, so what is
// refused here and what is published there are one document.
//
// Everything wrong is reported at once, capped: each probe was a round trip
// a user waited through, and a defect per call is the expensive way to
// find three of them.

/** The slice of Ajv's error object this formatter reads. */
interface SchemaError {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}

/**
 * How many defects are spelled out before the rest are counted. The same
 * shape as the findings cap and for the same reason: a diagram whose every
 * node is misshapen has one cause and many symptoms.
 */
const MAX_DEFECTS = 20;

// The generated module is `@ts-nocheck`, so its export reaches here as a
// bare function type with no `errors` on it. The shape it actually has is
// Ajv's: a predicate that leaves its complaints on itself.
const validateDiagram = validateGenerated as ((data: unknown) => boolean) & {
  errors?: SchemaError[] | null;
};

/** `/edges/0/from` as a caller wrote it: `edges[0].from`. */
const at = (path: string) =>
  path
    .replace(/\/(\d+)(?=\/|$)/g, '[$1]')
    .replace(/\//g, '.')
    .replace(/^\./, '') || 'the diagram';

const quote = (value: unknown) => JSON.stringify(value);

/**
 * One defect as one sentence, in the voice core's own refusals use: the
 * element, the field, the expectation, and where it is worth a clause, the
 * fix. The two hand-written hints answer the two guesses every caller makes
 * first - measured, not imagined: both were burned twice in the session the
 * feedback file records.
 */
const sentence = (error: SchemaError): string => {
  const path = at(error.instancePath);
  switch (error.keyword) {
    case 'additionalProperties': {
      const field = String(error.params.additionalProperty);
      const nudge =
        (field === 'text' || field === 'label') &&
        /^(?:nodes|notes|braces)\[\d+\]$/.test(path)
          ? ' - words go in "lines", an array of strings'
          : '';
      return `${path} has no field ${quote(field)}${nudge}`;
    }
    case 'required':
      return `${path} is missing ${quote(error.params.missingProperty)}`;
    case 'type': {
      const hint = /^edges\[\d+\]\.(?:from|to)$/.test(path)
        ? ' - an edge end is ["nodeId", "side"], like ["a", "r"]'
        : '';
      return `${path} must be ${error.params.type}${hint}`;
    }
    default:
      return `${path} ${error.message ?? 'does not match the schema'}`;
  }
};

/**
 * The member an `anyOf` branch error belongs to, and which branch said it.
 * `anyOf` in this schema sits only on the members of the four top-level
 * arrays, so the owner is the `/nodes/3` prefix of the instance path.
 */
const branchOf = (error: SchemaError) => {
  const index = /\/anyOf\/(\d+)\//.exec(error.schemaPath)?.[1];
  if (index === undefined) return null;
  const owner = /^\/\w+\/\d+/.exec(error.instancePath)?.[0];
  return owner === undefined ? null : { owner, index: Number(index) };
};

/**
 * Refuses a diagram that does not match `pensketch://schema`, saying every
 * way it does not, or passes it silently.
 *
 * Ajv reports `anyOf` the honest but unreadable way: every branch's
 * complaint plus a summary, so a node with one unknown field arrives as
 * eight errors, most of them the *other* branches explaining why they are
 * not the shape either. What a caller wants is the nearest branch's account
 * alone, so per member only the branch with the fewest complaints speaks -
 * with one exception. A `shape` no branch owns fails every branch at its
 * own constant, one indistinguishable error each, and there the honest line
 * is all of them at once: the allowed values, collected before the losing
 * branches are dropped.
 */
export function refuseDiagram(diagram: unknown): string | null {
  if (validateDiagram(diagram)) return null;
  const raw = (validateDiagram.errors ?? []) as SchemaError[];

  const perBranch = new Map<string, number>();
  for (const error of raw) {
    const b = branchOf(error);
    if (b) {
      const key = `${b.owner}|${b.index}`;
      perBranch.set(key, (perBranch.get(key) ?? 0) + 1);
    }
  }
  const best = new Map<string, number>();
  for (const [key, count] of perBranch) {
    const [owner = '', index = ''] = key.split('|');
    const standing = best.get(owner);
    if (
      standing === undefined ||
      count < (perBranch.get(`${owner}|${standing}`) ?? Infinity)
    )
      best.set(owner, Number(index));
  }

  // What a value was allowed to be, collected across *all* branches before
  // the losing ones are dropped: the group branch says `shape` by `const`
  // and the rest say it by `enum`, and only their union is the true list.
  const allowedAt = new Map<string, Set<unknown>>();
  const allow = (path: string, values: unknown[]) => {
    const set = allowedAt.get(path) ?? new Set();
    for (const value of values) set.add(value);
    allowedAt.set(path, set);
  };
  for (const error of raw) {
    if (error.keyword === 'const')
      allow(error.instancePath, [error.params.allowedValue]);
    if (error.keyword === 'enum')
      allow(error.instancePath, error.params.allowedValues as unknown[]);
  }

  // No dedupe beyond this: the summaries go because each carries no path a
  // branch error does not, and once every losing branch is dropped, one
  // member has one voice - ajv says each of a branch's complaints once.
  const kept = raw.filter((error) => {
    if (error.keyword === 'anyOf') return false;
    const b = branchOf(error);
    return !b || best.get(b.owner) === b.index;
  });

  const lines = kept.map((error) =>
    error.keyword === 'const' || error.keyword === 'enum'
      ? `${at(error.instancePath)} must be one of ${[
          ...(allowedAt.get(error.instancePath) ?? []),
        ]
          .map(quote)
          .join(', ')}`
      : sentence(error),
  );

  const rest = lines.length - MAX_DEFECTS;
  return [
    'The diagram does not match its schema:',
    ...lines.slice(0, MAX_DEFECTS).map((l) => `- ${l}`),
    ...(rest > 0 ? [`- and ${rest} more, not listed`] : []),
    'Every field is described by pensketch://schema; the get_schema tool returns the same document.',
  ].join('\n');
}
