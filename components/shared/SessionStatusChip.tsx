import { F, RADIUS, SESSION_STATUS_COLORS, SESSION_STATUS_LABELS } from "@lib/design/tokens";
import type { SessionStatus } from "@lib/types";

export function SessionStatusChip({ status }: { status: SessionStatus }) {
  const c = SESSION_STATUS_COLORS[status] ?? { color: "#86868B", bg: "#F2F2F7" };
  return (
    <span
      style={{
        ...F.body,
        fontSize: 12,
        fontWeight: 500,
        color: c.color,
        background: c.bg,
        padding: "3px 10px",
        borderRadius: RADIUS.pill,
      }}
    >
      {SESSION_STATUS_LABELS[status] ?? status}
    </span>
  );
}
