import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".paper-tool-data");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let filename = id;
  let title = `arXiv:${id}`;
  try {
    const raw = await fs.readFile(INDEX_PATH, "utf-8");
    const papers = JSON.parse(raw);
    const meta = papers.find((p: { id: string }) => p.id === id);
    if (meta?.filename) filename = meta.filename;
    if (meta?.title) title = meta.title;
  } catch {
    // index may not exist
  }

  const mdPath = path.join(DATA_DIR, `${filename}.md`);
  try {
    const markdown = await fs.readFile(mdPath, "utf-8");
    return NextResponse.json({ markdown, title, id });
  } catch {
    return NextResponse.json({ error: "论文未找到" }, { status: 404 });
  }
}
