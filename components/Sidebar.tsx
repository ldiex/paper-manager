"use client";

import { useState, useRef } from "react";
import InputBar from "@/components/InputBar";

interface PaperMeta {
  id: string;
  title: string;
  filename: string;
  savedAt: string;
}

interface SidebarProps {
  papers: PaperMeta[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (value: string) => void;
  onRename: (id: string, title: string) => void;
  folderMode: boolean;
  folderName: string | null;
  onOpenFolder: (files: FileList) => void;
  onCloseFolder: () => void;
}

export default function Sidebar({
  papers,
  selectedId,
  loading,
  onSelect,
  onDelete,
  onAdd,
  onRename,
  folderMode,
  folderName,
  onOpenFolder,
  onCloseFolder,
}: SidebarProps) {
  const [showInput, setShowInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const folderInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEdit = (paper: PaperMeta) => {
    setEditingId(paper.id);
    setEditTitle(paper.filename || paper.id);
    requestAnimationFrame(() => editInputRef.current?.select());
  };

  const submitEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const q = searchQuery.toLowerCase();
  const filteredPapers = q
    ? papers.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (p.filename || "").toLowerCase().includes(q)
      )
    : papers;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 p-3">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索 id / 标题 / 文件名"
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400"
          />
        </div>
      </div>
      <div className="border-b border-gray-200 p-3">
        {folderMode ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2">
              <span className="truncate text-xs text-gray-600">
                📁 {folderName}
              </span>
              <button
                onClick={onCloseFolder}
                className="ml-2 shrink-0 rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
                title="关闭文件夹"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ) : showInput ? (
          <InputBar
            onSubmit={(v) => {
              onAdd(v);
              setShowInput(false);
            }}
            loading={loading}
          />
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInput(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              添加论文
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center justify-center rounded-lg border border-gray-300 px-3 py-2.5 text-gray-600 transition hover:bg-gray-50"
              title="打开文件夹"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </button>
          </div>
        )}
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onOpenFolder(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </div>

      <nav className="flex-1 overflow-y-auto">
        {filteredPapers.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-400">
            {searchQuery ? "没有匹配的论文" : folderMode ? "该文件夹中没有 .md 文件" : "还没有保存的论文"}
          </p>
        ) : (
          <ul className="py-1">
            {filteredPapers.map((paper) => (
              <li key={paper.id}>
                <div
                  onClick={() => onSelect(paper.id)}
                  className={`group flex cursor-pointer items-center justify-between px-3 py-2.5 transition ${
                    selectedId === paper.id
                      ? "bg-blue-50 text-blue-700"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {editingId === paper.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        onBlur={submitEdit}
                        className="w-full rounded border border-blue-400 px-1.5 py-0.5 text-sm outline-none"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm ${
                            selectedId === paper.id
                              ? "font-medium"
                              : "font-normal text-gray-700"
                          }`}
                        >
                          {paper.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          {paper.filename || paper.id}.md
                        </p>
                      </div>
                      {!folderMode && (
                        <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(paper);
                            }}
                            className="rounded p-1 text-gray-400 transition hover:bg-blue-50 hover:text-blue-500"
                            title="重命名"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(paper.id);
                            }}
                            className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                            title="删除"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
