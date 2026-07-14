import { repository } from "@lib/storage";
import { mockupGenerationStore } from "@lib/mockup/generation-store";

/** Cancel generation, wipe repo history, and delete on-disk mock/transcript artifacts. */
export async function wipeTicketHistory(userId: string, ticketId: string): Promise<void> {
  mockupGenerationStore.cancel(userId, ticketId);
  await repository.resetTicketHistory(userId, ticketId);

  try {
    await fetch(`/api/mockups/purge?id=${encodeURIComponent(ticketId)}`, {
      method: "DELETE",
      cache: "no-store",
    });
  } catch {
    /* Best-effort — repo wipe already succeeded; disk cleanup may retry on next delete. */
  }
}
