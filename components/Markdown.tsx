"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children, dropcap = false }: { children: string; dropcap?: boolean }) {
  return (
    <div className={`answer-prose${dropcap ? " dropcap" : ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
