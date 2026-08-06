import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// StrictMode is here on purpose: in development it mounts every component
// twice and runs every effect twice, so a drawing that survives it is a
// drawing that clears before it draws. Both sketches below are drawn in
// effects, which makes this page the smoke test for that.
const root = document.getElementById('root') as HTMLElement;

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
