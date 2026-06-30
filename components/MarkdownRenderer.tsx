"use client";

import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";

function reactChildrenToText(children: React.ReactNode): string {
  if (children == null) return "";
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(reactChildrenToText).join("");
  if (React.isValidElement(children)) {
    const props = children.props as any;
    const tag = children.type;
    if (typeof tag === "string") {
      const attrStr = Object.keys(props)
        .filter((k) => k !== "children" && props[k] != null)
        .map((k) => {
          const key = k === "className" ? "class" : k;
          return ` ${key}="${String(props[k])}"`;
        })
        .join("");
      return `<${tag}${attrStr}>${reactChildrenToText(props.children)}</${tag}>`;
    }
    return reactChildrenToText(props.children);
  }
  return "";
}

function LatexCaption({ children, ...props }: any) {
  const content = reactChildrenToText(children);
  return (
    <figcaption {...props}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </figcaption>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    // Delay to ensure markdown is fully rendered
    const timer = setTimeout(scrollToHash, 100);

    window.addEventListener("hashchange", scrollToHash);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, [content]);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={{ figcaption: LatexCaption }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
