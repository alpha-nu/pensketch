import { PenSketch } from '@pensketch/react';
import { useEffect, useMemo, useState } from 'react';
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

// How long a stage holds before the incident moves on. Long enough to read the
// picture that just changed, which is the only thing this number has to be.
const STEP_MS = 1400;

export function App() {
  const [stage, setStage] = useState(0);
  const [seed, setSeed] = useState<number>(SEEDS[0]);
  // It plays on arrival, because the page's one claim is that the picture is
  // computed from state and a moving picture makes that in a second. Motion
  // that starts on its own needs a way to stop it, which the button is; the
  // media query is the part that button cannot do, for a reader whose system
  // has already asked everything for less movement.
  const [playing, setPlaying] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

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

  // Playing is a timer on that state and nothing else. pensketch animates
  // nothing and has no frame of its own: each step is a `draw` call reaching
  // the element by exactly the path a click on the control takes, and nothing
  // tweens between them.
  //
  // The seed holds across the steps, so a frame is not redrawn from scratch:
  // everything laid down before the first thing the stage changed comes back
  // stroke for stroke, and everything after it wobbles differently, because
  // inserting one box's hatching shifts the seeded sequence every later shape
  // draws from. Measured on the markup, `paged` to `triage` keeps 50 of its 80
  // paths, and `fixed?` to `all clear` keeps all 182 - that last step moves no
  // geometry at all, only colour and dash.
  //
  // The cleanup is what the stop button is made of. `playing` going false
  // re-runs this effect, and clearing the interval on the way out is the only
  // thing that ends it: without the clear, the button goes back to reading
  // "play" while the picture carries on stepping every 1400 ms, and a second
  // play leaves two timers stepping it in pairs.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () => setStage((s) => (s + 1) % STAGES.length),
      STEP_MS,
    );
    return () => clearInterval(id);
  }, [playing]);

  return (
    <main>
      <h1>pensketch in React</h1>
      <p>
        An incident, and where it is right now. Three things in the picture are
        derived from that: which stage is accented, which are shaded behind it,
        and which arrows have been taken. It walks itself through on arrival,
        redrawing by the same route the controls below take.
      </p>

      <fieldset>
        <legend>stage</legend>
        {STAGES.map((label, i) => (
          <label key={label}>
            <input
              type="radio"
              name="stage"
              checked={i === stage}
              // Reaching for a stage by hand stops the playback: two things
              // driving one value fight over it, and the hand should win.
              //
              // On `click` rather than on `change`, because clicking the radio
              // that is already checked fires no `change` at all - and with
              // the picture moving on its own, clicking the one currently
              // showing is exactly the gesture for "stop it here". `click`
              // fires for the keyboard too.
              onClick={() => setPlaying(false)}
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

      <button type="button" onClick={() => setPlaying((on) => !on)}>
        {playing ? 'stop animation' : 'play animation'}
      </button>

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
