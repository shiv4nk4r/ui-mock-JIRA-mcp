"use client";

import { MockupAspectFrame } from "@/components/shared/MockupAspectFrame";
import { MockupIframe } from "@/components/shared/MockupIframe";

interface Props {
  html: string;
  title?: string;
  className?: string;
}

export function ReviewMockPreview({ html, title = "Review mockup", className = "" }: Props) {
  if (!html) {
    return (
      <div
        className={`flex-1 flex items-center justify-center min-h-0 ${className}`}
        style={{ background: "#f5f5f7" }}
      >
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: 14, color: "#8E8E93" }}>
          No mockup preview available
        </p>
      </div>
    );
  }

  return (
    <MockupAspectFrame className={`flex-1 min-h-0 ${className}`}>
      <MockupIframe html={html} className="w-full h-full" title={title} />
    </MockupAspectFrame>
  );
}
