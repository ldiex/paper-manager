import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;

function extractArxivId(input: string): string | null {
  const match = input.match(/(\d{4}\.\d{4,5})/);
  return match ? match[1] : null;
}

interface PythonResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function runPython(arxivId: string): Promise<PythonResult> {
  const scriptPath = path.join(process.cwd(), "scripts", "arxiv_to_md.py");
  const venvPython = path.join(process.cwd(), ".venv", "bin", "python3");

  return new Promise((resolve) => {
    const proc = spawn(venvPython, [scriptPath, arxivId], {
      timeout: 15000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });
    proc.on("error", () => {
      resolve({ stdout, stderr, exitCode: -1 });
    });
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const input: string = body?.url?.trim();

  if (!input) {
    return NextResponse.json({ error: "请输入 arXiv ID 或 URL" }, { status: 400 });
  }

  const id = extractArxivId(input);
  if (!id) {
    return NextResponse.json(
      { error: "无法解析 arXiv ID，请检查输入" },
      { status: 400 }
    );
  }

  const result = await runPython(id);

  if (result.exitCode !== 0 || !result.stdout.trim()) {
    const errMsg = result.stderr.trim() || "未知错误";
    return NextResponse.json(
      { error: `转换失败: ${errMsg}` },
      { status: 502 }
    );
  }

  try {
    const data = JSON.parse(result.stdout.trim());
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "解析 Python 输出失败" },
      { status: 500 }
    );
  }
}
