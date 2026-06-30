# Paper Manager

A web app that converts arXiv papers to Markdown and renders them with LaTeX formula support, figure/table captions, and hash-based section navigation.

## Tech Stack

- **Frontend**: Next.js 14 (TypeScript), React, Tailwind CSS, react-markdown, KaTeX
- **Backend**: Python (arxiv2md library via uv venv), called through subprocess from Next.js API routes

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [uv](https://docs.astral.sh/uv/) (Python package manager)

## Setup

### 1. Install Node.js dependencies

```bash
npm install
```

### 2. Set up Python virtual environment

```bash
uv venv .venv
uv pip install arxiv2markdown==0.1.0
```

> The `arxiv2markdown` version is pinned to `0.1.0` because `scripts/arxiv_to_md.py` includes workarounds for bugs specific to that version (article-level figures and span-based `ltx_tabular` tables being dropped).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Click **"添加论文"** in the sidebar and enter an arXiv ID (e.g., `2606.27377`) or URL.
2. The app fetches the arXiv HTML, converts it to Markdown via the Python backend, and renders it with LaTeX support.
3. Papers are saved locally in `.paper-tool-data/` and can be reopened, renamed, or deleted.
4. Use **"打开文件夹"** to browse a local folder of `.md` files.
5. Hash anchors (e.g., `#S7.SS1`, `#S0.F1`) navigate to specific sections, figures, and tables.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── convert/route.ts    # POST: calls Python script to convert arXiv paper
│   │   └── papers/              # CRUD for saved papers
│   ├── globals.css              # Markdown rendering styles (KaTeX, tables, figcaptions)
│   ├── layout.tsx               # Root layout with Noto Serif font
│   └── page.tsx                 # Main UI (sidebar + markdown viewer)
├── components/
│   ├── MarkdownRenderer.tsx     # react-markdown + KaTeX + hash navigation
│   ├── Sidebar.tsx              # Paper list, add/delete/rename, folder mode
│   └── InputBar.tsx             # arXiv ID/URL input
├── scripts/
│   └── arxiv_to_md.py           # Core converter: fetches arXiv HTML, fixes figures/tables/math
├── pyproject.toml               # Python project config (arxiv2markdown dependency)
└── .paper-tool-data/            # Local storage (gitignored)
```
