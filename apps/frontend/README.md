# GameSwipe Frontend (apps/frontend)

Vite + React + TypeScript frontend for GameSwipe (room-based multiplayer game picker).

## Tech stack

- React + TypeScript (Vite)
- ESLint via the repo root config (`eslint.config.mjs`)

## Run locally

### Prerequisites

- Node.js (same version as repo standard)
- Backend running locally (for any API calls the UI makes)

### Install dependencies (from repo root)

```bash
npm install
```

### Start frontend dev server (from repo root)

```BASH
npm --workspace apps/frontend run dev
```

Vite will print the local URL (typically something like <http://localhost:5173>).

### Environment variables

These are read from the repo root `.env` (recommended):

```env
FRONTEND_PORT=5173
VITE_API_BASE_URL=<http://localhost:4000>
```

### Scripts

Run from the repo root:

```BASH
npm --workspace apps/frontend run dev
npm --workspace apps/frontend run build
npm --workspace apps/frontend run preview
npm --workspace apps/frontend run lint
```

### Project structure

- `src/pages/` - route-level pages (Room create/join, Swipe, Results)
- `src/components/` - reusable UI components
- `src/api/` - typed API client + DTOs (prefer shared types from packages/shared)
- `src/state/` - client state + server cache (if you adopt React Query or similar)
- `src/styles/` - global styles / theme tokens
