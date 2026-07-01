# Architecture

## Overview

Next.js 14 App Router application with a Python subprocess backend for arXiv paper conversion. No database — file-based storage for saved papers.

## Module Structure

```
app/
  layout.tsx              Root layout (Noto Serif font, Chinese lang)
  page.tsx                Main client component (paper CRUD, folder mode, state)
  globals.css             Tailwind + KaTeX CSS + .markdown-body styles
  api/
    convert/route.ts      POST /api/convert — spawns Python subprocess
    papers/route.ts       GET/POST/DELETE/PATCH /api/papers — collection CRUD
    papers/[id]/route.ts  GET /api/papers/:id — single paper read
components/
  MarkdownRenderer.tsx    react-markdown with remark-math, rehype-katex, rehype-highlight, rehype-raw
  Sidebar.tsx             Paper list with add/delete/rename, folder open
  InputBar.tsx            arXiv ID/URL text input
scripts/
  arxiv_to_md.py          Core converter: fetch arXiv HTML → fix bugs → convert to Markdown
```

## Subprocess Bridge Pattern

The core conversion flow crosses the TypeScript/Python boundary via `child_process.spawn`:

1. `app/api/convert/route.ts` extracts arXiv ID from user input
2. Spawns `.venv/bin/python3 scripts/arxiv_to_md.py <arxiv_id>`
3. 15-second timeout on the subprocess
4. Python script outputs JSON to stdout: `{ "markdown": "...", "title": "...", "id": "..." }`
5. API route parses JSON and returns it to the client

All API routes use `export const runtime = "nodejs"` (not edge). The convert route sets `export const maxDuration = 30`.

## File-Based Storage

Papers are stored in `.paper-tool-data/`:
- `index.json` — Array of `{ id, title, filename, savedAt }` objects
- `{filename}.md` — Individual paper markdown content

CRUD operations in `app/api/papers/route.ts` read/write both `index.json` and `.md` files. The data directory is created on demand with `fs.mkdir({ recursive: true })`.

## Python Conversion Pipeline (`scripts/arxiv_to_md.py`)

Multi-stage HTML-to-Markdown conversion with workarounds for arxiv2md bugs:

1. `convert_span_tables()` — Converts `<span class="ltx_tabular">` to proper `<table>` elements
2. `inject_figure_ids()` — Injects `<a id="...">` anchors into figures (arxiv2md discards these)
3. `build_figure_id_map()` — Maps "Figure N"/"Table N" labels to arXiv element IDs
4. `extract_article_figures()` — Extracts figures at article level (missed by section-only parsing)
5. `expand_spans()` / `_expand_table_spans()` — Expands colspan/rowspan (arxiv2md ignores these)
6. `fix_figures()` — Converts "Figure: caption" + "Refer to caption: src" to proper Markdown images
7. `fix_table_captions()` — Moves table captions from bold lines above tables to `<figcaption>` below
8. `fix_display_math()` — Fixes nested `$$ $latex$ $$` patterns

Uses arxiv2md functions: `fetch_arxiv_html`, `parse_arxiv_html`, `filter_sections`, `convert_fragment_to_markdown`. Filters out "references" and "bibliography" sections. Resolves relative image URLs using `<base>` tag detection.

## Data Flow

```
User Input (arXiv ID/URL)
  → page.tsx (handleAdd)
    → POST /api/convert
      → convert/route.ts (extractArxivId + spawn Python)
        → scripts/arxiv_to_md.py
      ← JSON {markdown, title, id}
    → POST /api/papers (save)
  ← Paper saved & displayed

User Selection
  → page.tsx (handleSelect)
    → GET /api/papers/{id}
  ← Paper rendered in MarkdownRenderer

Local Folder Mode
  → page.tsx (handleOpenFolder)
    → File API reads .md files into memory
  ← Papers rendered from in-memory folderContents
```

## Client-Side State

`app/page.tsx` uses React `useState` hooks exclusively (no external state management). Two modes: "normal mode" (arXiv papers from API) and "folder mode" (local .md files via File API).

## Markdown Rendering Pipeline

`components/MarkdownRenderer.tsx` uses react-markdown with:
- **remark plugins**: `remark-math`, `remark-gfm`
- **rehype plugins**: `rehype-raw`, `rehype-katex`, `rehype-highlight`
- Custom `LatexCaption` component for `<figcaption>` rendering with nested ReactMarkdown
- Hash-based navigation: scrolls to `window.location.hash` on content change and hashchange events
