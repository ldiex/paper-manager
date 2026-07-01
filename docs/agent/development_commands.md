# Development Commands

## Setup

### Node.js Dependencies
```bash
npm install
```

### Python Virtual Environment
```bash
uv venv .venv
uv pip install arxiv2markdown==0.1.0
```
The Python venv is required at `.venv/` — the API route `app/api/convert/route.ts` spawns `.venv/bin/python3` directly.

**Important**: `arxiv2markdown` is pinned to `0.1.0` because `scripts/arxiv_to_md.py` contains workarounds for bugs in that version. Do not upgrade without updating the workarounds.

## Development

```bash
npm run dev
```
Starts Next.js dev server on `http://localhost:3000`.

## Linting

```bash
npm run lint
```
Runs `next lint` (ESLint). This is the only quality check — no tests exist in this project.

## Build

```bash
npm run build
```
Production build via `next build`.

## Start (Production)

```bash
npm run start
```
Starts the production server after a build.

## Runtime Data Directories

These directories are gitignored and created on demand at runtime:
- `.paper-tool-data/` — Saved paper `.md` files + `index.json` metadata
- `.arxiv2md_cache/` — arxiv2md HTML fetch cache
- `.venv/` — Python virtual environment
- `.next/` — Next.js build output
