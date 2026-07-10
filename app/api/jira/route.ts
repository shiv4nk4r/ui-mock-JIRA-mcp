import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Atlassian Document Format → plain text ────────────────────────────────────

interface AdfNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
}

function adfToText(node: AdfNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text")      return node.text ?? "";
  if (node.type === "mention")   return `@${(node.attrs?.displayName as string) ?? "someone"}`;
  if (node.type === "hardBreak") return "\n";
  if (!node.content)             return "";
  const children = node.content.map(adfToText).join("");
  const blockTypes = new Set(["paragraph","bulletList","orderedList","listItem","blockquote","codeBlock","heading"]);
  return children + (blockTypes.has(node.type) ? "\n" : "");
}

// ── HTML → readable text ──────────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}

function fmtBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ── URL extraction & fetching ─────────────────────────────────────────────────

/** Design/prototype tools — cannot auto-fetch their content */
const DESIGN_TOOLS: Array<{ pattern: string; label: string }> = [
  { pattern: "figma.com",       label: "Figma design/mockup" },
  { pattern: "marvelapp.com",   label: "Marvel prototype" },
  { pattern: "figr.com",        label: "Figr design" },
  { pattern: "figr.design",     label: "Figr design" },
  { pattern: "zeplin.io",       label: "Zeplin design spec" },
  { pattern: "invisionapp.com", label: "InVision prototype" },
  { pattern: "miro.com",        label: "Miro board" },
  { pattern: "lucid.app",       label: "Lucidchart diagram" },
  { pattern: "whimsical.com",   label: "Whimsical diagram" },
  { pattern: "draw.io",         label: "Draw.io diagram" },
  { pattern: "excalidraw.com",  label: "Excalidraw diagram" },
  { pattern: "balsamiq.com",    label: "Balsamiq mockup" },
  { pattern: "adobe.com/xd",    label: "Adobe XD design" },
  { pattern: "sketch.com",      label: "Sketch design" },
  { pattern: "overflow.io",     label: "Overflow user flow" },
];

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|svg|ico|webp|bmp|tiff|mp4|mp3|wav|avi|mov)$/i;

export interface LinkedUrl {
  url: string;
  type: "design-tool" | "html" | "json" | "text" | "binary" | "error" | "skip";
  tool?: string;
  title?: string;
  content: string;
}

function extractUrls(texts: string[], jiraBaseUrl?: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"'\])\},;]+/g;
  const all = texts.flatMap((t) => t.match(urlRegex) ?? []);
  return Array.from(new Set(all))
    .map((u) => u.replace(/[.,;!?]+$/, ""))           // strip trailing punctuation
    .filter((u) => u.length > 10 && u.length < 500)   // sanity bounds
    .filter((u) => !IMAGE_EXT.test(u))                 // skip media
    .filter((u) => !u.includes("/secure/attachment/")) // Jira attachments handled separately
    .filter((u) => !u.includes("/rest/api/"))          // Jira API calls
    // Never scrape Jira ticket pages — they would pull in parent/linked ticket data
    .filter((u) => !u.includes("/browse/"))
    .filter((u) => !jiraBaseUrl || !u.startsWith(jiraBaseUrl))
    .slice(0, 10);                                     // hard cap
}

const MAX_LINK_CONTENT = 3_000;
const FETCH_TIMEOUT_MS = 7_000;
const MAX_LINKS_TO_FETCH = 6;

async function fetchUrl(url: string): Promise<LinkedUrl> {
  // Design tool — note it but don't try to fetch
  const tool = DESIGN_TOOLS.find((d) => url.includes(d.pattern));
  if (tool) {
    return {
      url, type: "design-tool", tool: tool.label,
      content: `[${tool.label}] This is a UI design/prototype link. The AI can reference the URL directly.`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PM-Context-Agent/1.0; +ai-pm-tool)",
        "Accept":     "text/html,application/json,text/plain,*/*;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) return { url, type: "error", content: `[HTTP ${res.status} — could not retrieve]` };

    const ct  = res.headers.get("content-type") ?? "";
    const raw = await res.text();

    // JSON
    if (ct.includes("application/json") || url.endsWith(".json")) {
      return { url, type: "json", content: raw.slice(0, MAX_LINK_CONTENT) };
    }

    // HTML — strip markup, extract text + title
    if (ct.includes("text/html") || raw.trimStart().startsWith("<!")) {
      const titleMatch = raw.match(/<title[^>]*>([^<]{1,150})<\/title>/i);
      const title      = titleMatch?.[1]?.trim();
      const text       = htmlToText(raw).slice(0, MAX_LINK_CONTENT);
      return { url, type: "html", title, content: text };
    }

    // Plain text / markdown
    if (ct.startsWith("text/") || ct.includes("markdown")) {
      return { url, type: "text", content: raw.slice(0, MAX_LINK_CONTENT) };
    }

    // Binary / unknown
    return { url, type: "binary", content: "[Binary or unknown content type — skipped]" };

  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : "unknown error";
    return { url, type: "error", content: `[Could not fetch: ${msg}]` };
  }
}

// ── Attachment content (with HTML cleanup) ────────────────────────────────────

const TEXT_MIME = new Set(["text/plain","text/markdown","text/html","text/csv","application/json","application/x-yaml"]);
const TEXT_EXT  = new Set([".md",".txt",".json",".ts",".tsx",".js",".jsx",".vue",".css",".scss",".py",".java",".yaml",".yml",".csv",".xml",".sh",".html",".htm"]);

function isTextFile(filename: string, mimeType: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return TEXT_MIME.has(mimeType) || TEXT_EXT.has(ext) || mimeType.startsWith("text/");
}

function cleanAttachmentContent(raw: string, filename: string, mimeType: string): string {
  const isHtml = mimeType.includes("text/html") ||
    filename.endsWith(".html") || filename.endsWith(".htm") ||
    raw.trimStart().startsWith("<!");
  return isHtml ? htmlToText(raw) : raw;
}

const MAX_ATTACHMENT_CHARS = 8_000;
const MAX_TEXT_ATTACHMENTS = 5;

// ── Mock response ─────────────────────────────────────────────────────────────

function mockResponse(id: string) {
  return NextResponse.json({
    id,
    summary: `[Mock] ${id}: Shift Planning UI Redesign`,
    description:
      "As a warehouse manager, I need a visual shift planner.\n\n" +
      "Reference designs: https://www.figma.com/file/mock-shift-planner-design\n" +
      "API docs: https://httpbin.org/get\n" +
      "Specification: The planner must support drag-and-drop assignment, conflict detection, " +
      "and real-time headcount tracking per zone. Must integrate with the existing WMS shift management APIs.",
    metadata: {
      status: "In Progress", priority: "High", assignee: "Priya Sharma",
      reporter: "Rahul Mehta", issueType: "Story", labels: ["frontend", "ux", "phase-2"],
      storyPoints: undefined,
    },
    comments: [
      { author: "Priya Sharma", body: "The drag-and-drop needs to work on touch devices. See Marvel prototype: https://marvelapp.com/mock-prototype", created: "Jun 1, 2026" },
      { author: "Dev Lead",     body: "Use qcalendar — already in the stack. Docs at https://quasar.dev/vue-components/calendar", created: "Jun 3, 2026" },
    ],
    subtasks: [
      { id: `${id}-1`, summary: "Implement weekly calendar component",    status: "In Progress", priority: "High"   },
      { id: `${id}-2`, summary: "Add drag-and-drop shift assignment",      status: "To Do",       priority: "High"   },
      { id: `${id}-3`, summary: "Integrate with shift management GraphQL", status: "To Do",       priority: "Medium" },
    ],
    linkedIssues: [
      { id: "GM-245999", summary: "WMS Shift Manager API refactor",      type: "is blocked by", status: "Done"        },
      { id: "GM-246100", summary: "Mobile-first responsive design audit", type: "relates to",   status: "In Progress" },
    ],
    attachments: [
      { filename: "shift-planner-wireframes.pdf", mimeType: "application/pdf", size: 204800, sizeLabel: "200 KB" },
      { filename: "api-contract.md", mimeType: "text/markdown", size: 2048, sizeLabel: "2 KB",
        content: "# Shift Manager API\n\n## GET /shifts\nReturns all shifts for a given week.\n\n## POST /shifts\nCreates a new shift assignment.\n\nRequest body: `{ zoneId, workerId, start, end, shiftType }`" },
    ],
    linkedUrls: [
      { url: "https://www.figma.com/file/mock-shift-planner-design", type: "design-tool", tool: "Figma design/mockup",
        content: "[Figma design/mockup] This is a UI design/prototype link. The AI can reference the URL directly." },
      { url: "https://marvelapp.com/mock-prototype", type: "design-tool", tool: "Marvel prototype",
        content: "[Marvel prototype] This is a UI design/prototype link. The AI can reference the URL directly." },
    ] as LinkedUrl[],
  });
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim().toUpperCase();
  if (!id) return NextResponse.json({ error: "Missing ticket id" }, { status: 400 });

  const email   = process.env.JIRA_USER_EMAIL;
  const token   = process.env.JIRA_API_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL;

  if (!email || !token || !baseUrl || email.includes("your-email")) {
    return mockResponse(id);
  }

  const auth    = `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
  const headers = { Authorization: auth, Accept: "application/json" };

  try {
    const fields = [
      "summary","description","comment","attachment",
      "subtasks","issuelinks","labels","priority","status",
      "assignee","reporter","issuetype",
      // "parent" intentionally excluded — we only want the entered ticket's own data
      "customfield_10016","customfield_10028",
    ].join(",");

    const issueRes = await fetch(`${baseUrl}/rest/api/3/issue/${id}?fields=${fields}`, { headers, cache: "no-store" });

    if (!issueRes.ok) {
      const text = await issueRes.text();
      return NextResponse.json({ error: `Jira returned ${issueRes.status}: ${text}` }, { status: issueRes.status });
    }

    const issue = await issueRes.json();
    const f = issue.fields ?? {};

    // ── Core text ──────────────────────────────────────────────────────────
    const summary = (f.summary as string) ?? "(No summary)";
    const description = typeof f.description === "string"
      ? f.description : adfToText(f.description as AdfNode).trim();

    // ── Metadata ───────────────────────────────────────────────────────────
    const metadata = {
      status:      (f.status    as { name: string } | null)?.name ?? "Unknown",
      priority:    (f.priority  as { name: string } | null)?.name ?? "None",
      assignee:    (f.assignee  as { displayName: string } | null)?.displayName ?? "Unassigned",
      reporter:    (f.reporter  as { displayName: string } | null)?.displayName ?? "Unknown",
      issueType:   (f.issuetype as { name: string } | null)?.name ?? "Issue",
      labels:      (f.labels ?? []) as string[],
      storyPoints: ((f.customfield_10016 ?? f.customfield_10028) as number | null) ?? undefined,
    };

    // ── Comments ───────────────────────────────────────────────────────────
    type RawComment = { author?: { displayName?: string }; body?: unknown; created?: string };
    const rawComments: RawComment[] = (f.comment as { comments?: RawComment[] })?.comments ?? [];
    const comments = rawComments.map((c) => ({
      author:  c.author?.displayName ?? "Unknown",
      body:    typeof c.body === "string" ? c.body.trim() : adfToText(c.body as AdfNode).trim(),
      created: c.created ? fmtDate(c.created) : "",
    }));

    // ── Subtasks ───────────────────────────────────────────────────────────
    type RawSubtask = { key?: string; fields?: { summary?: string; status?: { name?: string }; priority?: { name?: string } } };
    const subtasks = ((f.subtasks ?? []) as RawSubtask[]).map((s) => ({
      id:       s.key ?? "",
      summary:  s.fields?.summary ?? "",
      status:   s.fields?.status?.name ?? "Unknown",
      priority: s.fields?.priority?.name,
    })).filter((s) => s.id);

    // ── Linked issues ──────────────────────────────────────────────────────
    type RawLink = {
      type?: { inward?: string; outward?: string };
      inwardIssue?:  { key?: string; fields?: { summary?: string; status?: { name?: string } } };
      outwardIssue?: { key?: string; fields?: { summary?: string; status?: { name?: string } } };
    };
    // Link types that express parent-child hierarchy — exclude from linked issues
    // so we only show peer/blocking/related links, not ancestry.
    const PARENT_LINK_PATTERNS = /\b(parent|child|epic.?link|is.?part.?of|belongs.?to|is.?child.?of|is.?subtask.?of|epic)/i;

    const linkedIssues = ((f.issuelinks ?? []) as RawLink[]).flatMap((l) => {
      const results = [];
      const inwardType  = l.type?.inward  ?? "";
      const outwardType = l.type?.outward ?? "";
      if (l.inwardIssue  && !PARENT_LINK_PATTERNS.test(inwardType)) results.push({
        id: l.inwardIssue.key ?? "", type: inwardType || "linked to",
        summary: l.inwardIssue.fields?.summary ?? "", status: l.inwardIssue.fields?.status?.name ?? "Unknown",
      });
      if (l.outwardIssue && !PARENT_LINK_PATTERNS.test(outwardType)) results.push({
        id: l.outwardIssue.key ?? "", type: outwardType || "linked to",
        summary: l.outwardIssue.fields?.summary ?? "", status: l.outwardIssue.fields?.status?.name ?? "Unknown",
      });
      return results;
    }).filter((l) => l.id);

    // ── Attachments (meta + text content with HTML cleanup) ───────────────
    type RawAttachment = { filename?: string; mimeType?: string; size?: number; content?: string };
    const rawAttachments: RawAttachment[] = (f.attachment ?? []) as RawAttachment[];

    const textCandidates = rawAttachments
      .filter((a) => a.filename && a.content && isTextFile(a.filename!, a.mimeType ?? "") && (a.size ?? 0) < 200_000)
      .slice(0, MAX_TEXT_ATTACHMENTS);

    const attachments = await Promise.all(
      rawAttachments.map(async (a) => {
        const base = { filename: a.filename ?? "unknown", mimeType: a.mimeType ?? "application/octet-stream", size: a.size ?? 0, sizeLabel: fmtBytes(a.size ?? 0) };
        if (!textCandidates.some((tc) => tc.content === a.content)) return base;
        try {
          const attRes = await fetch(a.content!, { headers, cache: "no-store" });
          if (!attRes.ok) return base;
          const raw  = await attRes.text();
          const clean = cleanAttachmentContent(raw, a.filename!, a.mimeType!);
          return { ...base, content: clean.slice(0, MAX_ATTACHMENT_CHARS) };
        } catch { return base; }
      })
    );

    // ── URL extraction + fetch ────────────────────────────────────────────
    // Only extract URLs from the current ticket's own text — not parent/linked tickets.
    const commentBodies = comments.map((c) => c.body);
    const allUrls = extractUrls([description, ...commentBodies], baseUrl);

    // Fetch up to MAX_LINKS_TO_FETCH URLs in parallel
    const urlsToFetch = allUrls.slice(0, MAX_LINKS_TO_FETCH);
    const linkedUrls: LinkedUrl[] = urlsToFetch.length > 0
      ? await Promise.all(urlsToFetch.map((u) => fetchUrl(u)))
      : [];

    return NextResponse.json({ id, summary, description, metadata, comments, subtasks, linkedIssues, attachments, linkedUrls });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
