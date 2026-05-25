# chess-3d-15

This repository contains the initial scaffold for graph task `chess-001`: a browser-based 3D chess app shell built with React, TypeScript, and a React Three Fiber-ready stack.

## Stack

- Vite
- React 18
- TypeScript
- React Router
- Three.js and React Three Fiber
- Vitest and Testing Library
- ESLint and Prettier

## Local setup

Use a current Node.js LTS release, then run:

```bash
npm install
```

## Local development

1. Start the dev server:

   ```bash
   npm run dev
   ```

2. Open the local URL printed by Vite.
3. Visit `/` for the landing page.
4. Visit `/game` for the minimal game shell route.

## Validation commands

```bash
npm run lint
npm run test -- --run
npm run build
```

## Scripts

- `npm run dev` starts the local development server.
- `npm run build` type-checks and creates the production bundle.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint across the project.
- `npm run test -- --run` runs the Vitest suite once.
- `npm run format` checks formatting with Prettier.
- `npm run format:write` rewrites files with the shared Prettier config.

## Project structure

- `src/app` contains the router and app entry component.
- `src/routes` contains the landing page and game shell route.
- `src/components` contains reusable layout and scaffold UI pieces.
- `src/styles` contains the global application stylesheet.
- `src/test` contains shared test setup.
- `public` contains static assets served by Vite.
