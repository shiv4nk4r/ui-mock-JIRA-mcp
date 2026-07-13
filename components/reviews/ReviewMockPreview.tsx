"use client";

import { MockupAspectFrame } from "@/components/shared/MockupAspectFrame";
import { MockupIframe } from "@/components/shared/MockupIframe";
import { MockAnnotationLayer } from "@/components/mock/MockAnnotationLayer";

interface Props {
  html: string;
  title?: string;
  className?: string;
  annotationTargetId?: string;
  onAnnotationsChange?: () => void;
}

export function ReviewMockPreview({
  html,
  title = "Review mockup",
  className = "",
  annotationTargetId,
  onAnnotationsChange,
}: Props) {
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
      {annotationTargetId ? (
        <MockAnnotationLayer
          html={html}
          targetId={annotationTargetId}
          title={title}
          className="absolute inset-0"
          onCommentsChange={onAnnotationsChange}
        />
      ) : (
        <MockupIframe html={html} className="absolute inset-0 w-full h-full" title={title} />
      )}
    </MockupAspectFrame>
  );
}
