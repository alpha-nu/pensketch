import { PenSketch } from '@pensketch/react';
import { BUDGETS } from './budgets';
import { CustomSketch } from './CustomSketch';

export function App() {
  return (
    <main>
      <h1>pensketch in React</h1>
      {/* The diagram is module-level, so it keeps its identity across
          renders and the effect redraws only when the seed or theme moves. */}
      <PenSketch
        diagram={BUDGETS}
        seed={11}
        viewBox="0 0 900 470"
        aria-label="Nested time budgets"
      />
      <CustomSketch />
    </main>
  );
}
