import { PenSketch } from '@pensketch/react';
import { useMemo, useState } from 'react';
import { Caption } from './Caption';
import { incident, STAGES, VIEW_BOX } from './incident';

// Four arbitrary seeds. Determinism is the point of this control: a seed picks
// one drawing out of the many the same data could produce, and picking it
// again brings back the same one, down to the byte.
// `as const` makes this a tuple, so SEEDS[0] below is the literal 3 rather
// than `number | undefined`: under noUncheckedIndexedAccess an array index
// may be missing, and exactOptionalPropertyTypes then refuses to hand that
// `undefined` to a `seed` that is declared optional but not nullable.
const SEEDS = [3, 7, 11, 19] as const;

export function App() {
  const [stage, setStage] = useState(0);
  const [seed, setSeed] = useState<number>(SEEDS[0]);

  // The two controls change different things, which is the whole point of the
  // page: the stage changes the *data*, and the seed changes which drawing of
  // that data you get.
  //
  // `<PenSketch>` compares `diagram` by identity, so a fresh object on every
  // render would redraw on every render. Memoized on the one value it is
  // derived from, the object changes identity when the incident moves and not
  // when anything else on the page does - which is what a diagram built from
  // state has to get right. The seed still redraws it, as it should: the
  // effect watches the seed and the theme too.
  const diagram = useMemo(() => incident(stage), [stage]);

  return (
    <main>
      <h1>pensketch in React</h1>
      <p>
        An incident, and where it is right now. Three things in the picture are
        derived from that: which stage is accented, which are shaded behind it,
        and which arrows have been taken.
      </p>

      <fieldset>
        <legend>stage</legend>
        {STAGES.map((label, i) => (
          <label key={label}>
            <input
              type="radio"
              name="stage"
              checked={i === stage}
              onChange={() => setStage(i)}
            />
            {label}
          </label>
        ))}
      </fieldset>

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

      <PenSketch
        diagram={diagram}
        seed={seed}
        viewBox={VIEW_BOX}
        aria-label="An incident, drawn at the stage it has reached"
      />

      <Caption />
    </main>
  );
}
