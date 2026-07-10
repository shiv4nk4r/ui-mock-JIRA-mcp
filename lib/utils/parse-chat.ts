export const HTML_START = "RAW_HTML_COMPONENT_START";
export const HTML_END = "RAW_HTML_COMPONENT_END";
export const EFFORT_MARKER = "### 📊 Engineering Effort Estimation Summary";

export function stripEffortFromText(text: string): { text: string; effortEstimation?: string } {
  const mi = text.indexOf(EFFORT_MARKER);
  if (mi < 0) return { text };
  return {
    text: text.slice(0, mi).trim(),
    effortEstimation: text.slice(mi).trim(),
  };
}
