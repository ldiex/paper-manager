"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface PaperMeta {
  id: string;
  title: string;
  filename: string;
  savedAt: string;
}

interface PaperResult {
  markdown: string;
  title: string;
  id: string;
}

function extractTitleFromMarkdown(md: string): string {
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled";
}

export default function Home() {
  const [papers, setPapers] = useState<PaperMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPaper, setCurrentPaper] = useState<PaperResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [folderMode, setFolderMode] = useState(false);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [folderPapers, setFolderPapers] = useState<PaperMeta[]>([]);
  const [folderContents, setFolderContents] = useState<Record<string, string>>({});

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch("/api/papers");
      const data = await res.json();
      setPapers(data.papers || []);
    } catch {
      // ignore
    }
  }, []);

  const loadPaper = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/papers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentPaper(data);
        setSelectedId(id);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchPapers();
    })();
  }, [fetchPapers]);

  const displayPapers = folderMode ? folderPapers : papers;

  const handleAdd = async (value: string) => {
    setLoading(true);
    setError(null);
    setCurrentPaper(null);

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "请求失败");
        return;
      }

      await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      await fetchPapers();
      setSelectedId(data.id);
      setCurrentPaper(data);
    } catch {
      setError("网络错误，请检查连接");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id: string) => {
    setSelectedId(id);
    setError(null);

    if (folderMode) {
      const md = folderContents[id];
      if (md !== undefined) {
        const title = extractTitleFromMarkdown(md);
        setCurrentPaper({ markdown: md, title, id });
      }
    } else {
      await loadPaper(id);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/papers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    await fetchPapers();

    if (selectedId === id) {
      setSelectedId(null);
      setCurrentPaper(null);
    }
  };

  const handleRename = async (id: string, filename: string) => {
    await fetch("/api/papers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, filename }),
    });

    await fetchPapers();
  };

  const handleOpenFolder = async (files: FileList) => {
    const mdFiles = Array.from(files).filter((f) => f.name.endsWith(".md"));

    if (mdFiles.length === 0) {
      setError("选中的文件夹中没有 .md 文件");
      return;
    }

    setError(null);
    setSelectedId(null);
    setCurrentPaper(null);

    const path = mdFiles[0].webkitRelativePath || mdFiles[0].name;
    const folderPath = path.includes("/") ? path.split("/")[0] : "Folder";
    setFolderName(folderPath);

    const metaList: PaperMeta[] = [];
    const contents: Record<string, string> = {};

    for (const file of mdFiles) {
      const id = file.name.replace(/\.md$/, "");
      const text = await file.text();
      contents[id] = text;
      const title = extractTitleFromMarkdown(text);
      metaList.push({ id, title, filename: id, savedAt: "" });
    }

    setFolderContents(contents);
    setFolderPapers(metaList);
    setFolderMode(true);
  };

  const handleCloseFolder = () => {
    setFolderMode(false);
    setFolderName(null);
    setFolderPapers([]);
    setFolderContents({});
    setSelectedId(null);
    setCurrentPaper(null);
    fetchPapers();
  };

  const copyMarkdown = () => {
    if (currentPaper?.markdown) {
      navigator.clipboard.writeText(currentPaper.markdown);
    }
  };

  const downloadMarkdown = () => {
    if (!currentPaper) return;
    const blob = new Blob([currentPaper.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentPaper.title.replace(/[/\\?%*:|"<>]/g, "_")}_${currentPaper.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        papers={displayPapers}
        selectedId={selectedId}
        loading={loading}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onRename={handleRename}
        folderMode={folderMode}
        folderName={folderName}
        onOpenFolder={handleOpenFolder}
        onCloseFolder={handleCloseFolder}
      />

      <main className="flex-1 overflow-y-auto">
        {error && (
          <div className="mx-auto mt-4 max-w-4xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {currentPaper ? (
          <div className="mx-auto max-w-4xl px-4 py-6">
            <div className="mb-4 flex justify-end gap-3">
              <button
                onClick={copyMarkdown}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-xs text-gray-600 transition hover:bg-gray-100"
              >
                复制 Markdown
              </button>
              {!folderMode && (
                <a
                  href={`https://www.alphaxiv.org/abs/${currentPaper.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-gray-300 px-4 py-1.5 text-xs text-gray-600 transition hover:bg-gray-100"
                >
                  AlphaXiv
                </a>
              )}
              <button
                onClick={downloadMarkdown}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-xs text-gray-600 transition hover:bg-gray-100"
              >
                下载 .md
              </button>
            </div>

            <article className="rounded-xl border border-gray-200 bg-white px-6 py-8 shadow-sm sm:px-10">
              <MarkdownRenderer content={currentPaper.markdown} />
            </article>
          </div>
        ) : (
          !loading &&
          !error && (
            <div className="flex h-full items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-sm">
                  {folderMode
                    ? "选择左侧文件开始阅读"
                    : "点击左侧\"添加论文\"开始阅读"}
                </p>
                {!folderMode && (
                  <p className="mt-1 text-xs">例如：2509.16117</p>
                )}
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
}
