# Conventions

## Language

The UI is entirely in **Chinese** — all button text, placeholder text, error messages, and labels are written in Chinese. Maintain this convention when modifying UI text.

## Path Aliases

TypeScript path alias `@/*` maps to the project root. Import components as:
```typescript
import Sidebar from '@/components/Sidebar'
```

## Code Style

- Tailwind CSS utility classes throughout (no CSS modules, no styled-components)
- Inline SVG icons (no icon library like lucide or heroicons)
- Group hover pattern for action buttons: `opacity-0 group-hover:opacity-100`
- React `useState` hooks only — no Redux, Zustand, or other state management
- `useCallback` for memoized fetch functions
- Client components marked with `"use client"` directive

## API Route Patterns

- App Router convention: each route is a `route.ts` file exporting named HTTP method functions
- All routes explicitly set `export const runtime = "nodejs"`
- JSON responses using `NextResponse.json()`
- Error responses include a `message` field in Chinese

## Python Script Conventions

- `scripts/arxiv_to_md.py` outputs JSON to stdout (never stderr for data)
- Errors output as JSON to stderr with `sys.exit(1)`
- The script takes exactly one argument: the arXiv paper ID
- All fix/workaround functions operate on BeautifulSoup objects before conversion to Markdown

## File Organization

- `app/` — Next.js App Router pages and API routes
- `components/` — Shared React UI components
- `scripts/` — Python backend scripts
- Runtime data directories (`.paper-tool-data/`, `.arxiv2md_cache/`, `.venv/`) are gitignored

## CSS Conventions

- Global styles in `app/globals.css`
- Markdown body styles scoped under `.markdown-body` class
- KaTeX CSS imported via `@import` in globals.css
- No CSS modules — all styling via Tailwind utilities or global CSS
