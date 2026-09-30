# Memory Thief

A browser memory game. You are shown a scene for a few seconds. The screen goes
blank, and when it comes back a thief has changed something — an object removed,
recoloured, moved, resized, mirrored, swapped for another, or relabelled. Your
job is to find what changed before the clock runs out.

Everything is drawn as SVG from a seeded generator: no image assets, no backend,
no API keys, no tracking. Progress lives in `localStorage` on your own device.

## Game modes

| Mode | What it is |
| --- | --- |
| **Classic** | Endless levels with 3 lives. More objects, more changes, shorter viewing time and subtler edits as you climb. |
| **Daily Challenge** | 5 fixed rounds seeded from the UTC date, so everyone plays the same puzzle. Once per day, with a shareable emoji result. |
| **Zen** | No timer, no lives, adjustable viewing time. |
| **Speed Run** | Clear as many scenes as you can in 2 minutes. |

## Features

- 39 hand-drawn SVG object kinds across 4 themes (Park, Kitchen, City Street, The Reef)
- 9 kinds of change, unlocked in tiers as difficulty rises
- Occasional "nothing changed" rounds — call them correctly to score
- Before/after reveal with a draggable comparison slider and plain-English descriptions
- Lifetime stats, including which kinds of change you miss most often
- 12 achievements with unlock toasts
- Light/dark theme, reduced motion, a colourblind-safe palette, and Web Audio sound — all toggleable
- Keyboard accessible, and sized to work from a 375px phone upwards

## Running locally

Requires Node 20 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open the printed URL (usually http://localhost:5173).

## Testing

Unit tests cover the seeded RNG, scene determinism, the mutation engine's
no-overlap invariant, hit detection, the daily seed, and all scoring maths.

```bash
npm test
```

Type checking and linting:

```bash
npm run build
```

```bash
npm run lint
```

## Production build

```bash
npm run build
```

```bash
npm run preview
```

`npm run build` emits a fully static site to `dist/`.

## Deploying to Vercel

The repo includes a `vercel.json` with an SPA rewrite so a hard refresh on any
path serves `index.html` instead of 404ing.

### Option A — GitHub + Vercel dashboard (recommended)

1. Create an empty repository on GitHub (no README, no `.gitignore`).
2. Push this project to it:
   ```bash
   git remote add origin https://github.com/<you>/memory-thief.git
   git branch -M main
   git push -u origin main
   ```
3. Go to <https://vercel.com/new> and import the repository.
4. Vercel should detect **Vite** automatically. Confirm:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
5. Click **Deploy**. Every later push to `main` redeploys automatically.

### Option B — Vercel CLI

```bash
npm i -g vercel
```

```bash
vercel login
```

```bash
vercel
```

```bash
vercel --prod
```

The first `vercel` run creates a preview deployment and links the project;
`vercel --prod` promotes it to production.

## Project structure

```
src/
  game/
    rng.ts             seeded PRNG (mulberry32) + helpers
    palette.ts         curated + colourblind-safe palettes, colour maths
    objects.ts         39 SVG object definitions and the 4 themes
    sceneGenerator.ts  seed + difficulty -> scene (rejection-sampling placement)
    mutations.ts       the thief: applies changes, guarantees no overlap
    round.ts           generator + mutations -> a playable round
    scoring.ts         pure scoring functions
    difficulty.ts      the difficulty curve per level and per mode
    daily.ts           UTC date -> seed, puzzle number, share text
    achievements.ts    unlock rules
    storage.ts         settings/stats/daily shapes and reducers
    sound.ts           Web Audio beeps and chimes
    types.ts
  components/          SceneView, GameScreen, RevealScreen, Menu, Stats, Settings, ...
  hooks/               useGameReducer, useLocalStorage
```

Scenes are a pure function of their seed, which is what makes the Daily
Challenge identical for every player and lets the reveal screen re-render the
original scene exactly.

## Licence

MIT.
