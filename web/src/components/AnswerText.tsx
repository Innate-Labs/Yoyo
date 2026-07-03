"use client";

import React from "react";

// 轻量渲染 AI 回答：支持 **加粗**，并把含"请立即就医"的独立行渲染为醒目高危块。
export function AnswerText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="answer-body">
      {lines.map((line, i) => {
        const isRiskLine = /请立即就医/.test(line);
        const content = renderInline(line);
        if (isRiskLine) {
          return (
            <div key={i} className="high-risk font-bold">
              {content}
            </div>
          );
        }
        return <p key={i}>{content}</p>;
      })}
    </div>
  );
}

// 解析 **bold**
function renderInline(line: string): React.ReactNode[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/);
    if (m) return <strong key={i}>{m[1]}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}
