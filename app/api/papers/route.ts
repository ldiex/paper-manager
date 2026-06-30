import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".paper-tool-data");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

interface PaperMeta {
  id: string;
  title: string;
  filename: string;
  savedAt: string;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readIndex(): Promise<PaperMeta[]> {
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf-8");
    const papers = JSON.parse(raw);
    for (const p of papers) {
      if (!p.filename) p.filename = p.id;
    }
    return papers;
  } catch {
    return [];
  }
}

async function writeIndex(papers: PaperMeta[]) {
  await ensureDataDir();
  await fs.writeFile(INDEX_PATH, JSON.stringify(papers, null, 2), "utf-8");
}

export async function GET() {
  const papers = await readIndex();
  papers.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return NextResponse.json({ papers });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { markdown, title, id } = body as {
    markdown: string;
    title: string;
    id: string;
  };

  if (!id || !markdown) {
    return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
  }

  await ensureDataDir();

  const papers = await readIndex();
  const existing = papers.find((p) => p.id === id);
  const filename = existing?.filename || id;

  await fs.writeFile(path.join(DATA_DIR, `${filename}.md`), markdown, "utf-8");

  const meta: PaperMeta = {
    id,
    title: title || `arXiv:${id}`,
    filename,
    savedAt: new Date().toISOString(),
  };
  const idx = papers.findIndex((p) => p.id === id);
  if (idx >= 0) {
    papers[idx] = meta;
  } else {
    papers.push(meta);
  }
  await writeIndex(papers);

  return NextResponse.json({ ok: true, paper: meta });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body as { id: string };

  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const papers = await readIndex();
  const paper = papers.find((p) => p.id === id);
  if (paper) {
    try {
      await fs.unlink(path.join(DATA_DIR, `${paper.filename}.md`));
    } catch {
      // file may not exist
    }
  }

  const filtered = papers.filter((p) => p.id !== id);
  await writeIndex(filtered);

  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, filename: newFilename } = body as { id: string; filename: string };

  if (!id || !newFilename) {
    return NextResponse.json({ error: "缺少 id 或 filename" }, { status: 400 });
  }

  const safeName = newFilename.trim().replace(/[/\\?%*:|"<>]/g, "_");
  if (!safeName) {
    return NextResponse.json({ error: "文件名无效" }, { status: 400 });
  }

  const papers = await readIndex();
  const idx = papers.findIndex((p) => p.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: "论文未找到" }, { status: 404 });
  }

  const oldFilename = papers[idx].filename;

  if (safeName !== oldFilename) {
    const oldPath = path.join(DATA_DIR, `${oldFilename}.md`);
    const newPath = path.join(DATA_DIR, `${safeName}.md`);
    try {
      await fs.rename(oldPath, newPath);
    } catch {
      // file may not exist, ignore
    }
    papers[idx].filename = safeName;
  }

  await writeIndex(papers);

  return NextResponse.json({ ok: true, paper: papers[idx] });
}
