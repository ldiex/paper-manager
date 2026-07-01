# AGENTS.md

This file provides guidance to codeflicker when working with code in this repository.

## WHY: Purpose and Goals
Web app that converts arXiv papers to Markdown and renders them with LaTeX formula support, figure/table captions, and hash-based section navigation. Bridges a Python conversion backend (arxiv2md) with a Next.js frontend.

## WHAT: Technical Stack
- Runtime/Language: TypeScript (Next.js 14 App Router) + Python 3.12
- Framework: Next.js 14, React 18, Tailwind CSS
- Key dependencies: react-markdown, KaTeX (remark-math + rehype-katex), rehype-highlight, rehype-raw, remark-gfm
- Backend: Python subprocess (arxiv2markdown==0.1.0) spawned from Next.js API routes
- Storage: File-based (`.paper-tool-data/` with `index.json` + `.md` files)

## HOW: Core Development Workflow
```bash
# Install dependencies
npm install && uv venv .venv && uv pip install arxiv2markdown==0.1.0

# Development
npm run dev

# Lint
npm run lint

# Build
npm run build
```

## Deployment
After updating code, always kill the existing server on port 3000 before redeploying:
```bash
# Kill existing process on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null; true

# Deploy to port 3000
npm run build && npm run start
```

## Progressive Disclosure

For detailed information, consult these documents as needed:

- `docs/agent/development_commands.md` - All build, dev, lint commands and setup details
- `docs/agent/architecture.md` - Module structure, data flow, and subprocess bridge pattern
- `docs/agent/conventions.md` - Code style, UI language, and project-specific patterns

**When working on a task, first determine which documentation is relevant, then read only those files.**
