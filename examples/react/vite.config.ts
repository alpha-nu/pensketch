import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // The pensketch packages are linked with `file:` specifiers, so they
    // resolve through their real paths in the monorepo - and `react` resolved
    // from there is a different file than `react` resolved from this app.
    // Without deduping, a production build ships both copies and the hooks in
    // the second one read a null dispatcher, which surfaces as a crash inside
    // `useRef`. The dev server hides this, so the build is where it shows up.
    dedupe: ['react', 'react-dom'],
  },
});
