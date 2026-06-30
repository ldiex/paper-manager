"use client";

import { useState, type KeyboardEvent } from "react";

interface InputBarProps {
  onSubmit: (value: string) => void;
  loading: boolean;
}

export default function InputBar({ onSubmit, loading }: InputBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = () => {
    if (value.trim() && !loading) {
      onSubmit(value.trim());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="flex w-full max-w-3xl gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入 arXiv ID 或 URL，如 2509.16117"
        disabled={loading}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !value.trim()}
        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "获取中..." : "获取论文"}
      </button>
    </div>
  );
}
