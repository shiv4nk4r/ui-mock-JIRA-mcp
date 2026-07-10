"use client";

import { normalizeMockupHtml } from "@lib/utils/mockup-html";

interface Props {
  html: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  minHeight?: number | string;
}

export function MockupIframe({ html, title = "Mockup", className, style, minHeight }: Props) {
  const srcDoc = normalizeMockupHtml(html);

  if (!srcDoc) {
    return (
      <div
        className={className}
        style={{
          ...style,
          minHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8E8E93",
          fontSize: 14,
        }}
      >
        No mockup preview
      </div>
    );
  }

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className={className}
      style={{ border: "none", ...style, minHeight }}
      title={title}
    />
  );
}
