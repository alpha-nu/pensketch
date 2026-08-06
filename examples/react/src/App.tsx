import { PenSketch } from '@pensketch/react';
import { useState } from 'react';
import { Caption } from './Caption';
import { OAUTH } from './oauth';

// Four arbitrary seeds. Determinism is the point of the control: a seed picks
// one drawing out of the many the same data could produce, and picking it
// again brings back the same one, down to the byte.
// `as const` makes this a tuple, so SEEDS[0] below is the literal 3 rather
// than `number | undefined`: under noUncheckedIndexedAccess an array index
// may be missing, and exactOptionalPropertyTypes then refuses to hand that
// `undefined` to a `seed` that is declared optional but not nullable.
const SEEDS = [3, 7, 11, 19] as const;

export function App() {
  const [seed, setSeed] = useState<number>(SEEDS[0]);

  return (
    <main>
      <h1>pensketch in React</h1>
      <p>
        The OAuth 2.0 authorization code flow, with PKCE. One plain object, four
        lanes, seven steps.
      </p>

      <fieldset>
        <legend>seed</legend>
        {SEEDS.map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="seed"
              checked={value === seed}
              onChange={() => setSeed(value)}
            />
            {value}
          </label>
        ))}
      </fieldset>

      {/* The diagram is module-level, so it keeps its identity across renders
          and the effect redraws only when the seed or theme moves - which is
          exactly what the control above changes. */}
      <PenSketch
        diagram={OAUTH}
        seed={seed}
        viewBox="0 0 880 400"
        aria-label="The OAuth 2.0 authorization code flow"
      />

      <Caption />
    </main>
  );
}
