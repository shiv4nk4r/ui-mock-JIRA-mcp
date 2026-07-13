"use client";

import { forwardRef } from "react";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";

interface Props {
  html: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  minHeight?: number | string;
  sandbox?: string;
}

export const MockupIframe = forwardRef<HTMLIFrameElement, Props>(function MockupIframe(
  { html, title = "Mockup", className, style, minHeight, sandbox = "allow-scripts" },
  ref,
) {
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
      ref={ref}
      srcDoc={srcDoc}
      sandbox={sandbox}
      className={className}
      style={{ border: "none", ...style, minHeight }}
      title={title}
    />
  );
});
