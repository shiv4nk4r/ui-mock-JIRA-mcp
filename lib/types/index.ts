export type UserRole = "external" | "internal";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
}

export type SessionStatus = "draft" | "in_progress" | "pending_review" | "reviewed" | "needs_changes";

export interface JiraMetadata {
  status: string;
  priority: string;
  assignee: string;
  reporter: string;
  issueType: string;
  labels: string[];
  storyPoints?: number;
}

export interface JiraComment {
  author: string;
  body: string;
  created: string;
}

export interface JiraSubtask {
  id: string;
  summary: string;
  status: string;
  priority?: string;
}

export interface JiraLinkedIssue {
  id: string;
  summary: string;
  type: string;
  status: string;
}

export interface JiraAttachment {
  filename: string;
  mimeType: string;
  size: number;
  sizeLabel?: string;
  content?: string;
}

export interface LinkedUrl {
  url: string;
  type: "design-tool" | "html" | "json" | "text" | "binary" | "error" | "skip";
  tool?: string;
  title?: string;
  content: string;
}

export interface TicketData {
  id: string;
  summary: string;
  description: string;
  metadata?: JiraMetadata;
  comments?: JiraComment[];
  subtasks?: JiraSubtask[];
  linkedIssues?: JiraLinkedIssue[];
  attachments?: JiraAttachment[];
  linkedUrls?: LinkedUrl[];
}

export interface ContentBlock {
  type: string;
  text: string;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
}

export interface ProviderConfig {
  provider: "claude-code" | "claude" | "gemini" | "openai" | "mock";
  providerLabel: string;
  baseUrl: string;
  defaultModel: string;
  models: ModelOption[];
}

export interface AttachedFile {
  name: string;
  type: string;
  size: number;
  sizeLabel: string;
  content: string;
  contentType: "text" | "html" | "image" | "binary";
}

export interface Message {
  id?: string;
  role: "user" | "assistant";
  text?: string;
  htmlComponent?: string;
  effortEstimation?: string;
  changeLog?: string;
  agentPrompt?: string;
  rawBlocks?: ContentBlock[];
  isStreaming?: boolean;
  thinking?: { log: string[]; elapsed?: number; done: boolean };
  attachedFiles?: Array<{ name: string; contentType: string; sizeLabel: string; htmlContent?: string }>;
}

export interface UsageRecord {
  timestamp: number;
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface MockupSession {
  id: string;
  userId: string;
  ticketId: string;
  ticketData: TicketData;
  messages: Message[];
  activeHtml: string;
  usageRecords: UsageRecord[];
  selectedModel: string;
  status: SessionStatus;
  savedAt: number;
  reviewId?: string;
}

export type ReviewStatus = "pending_review" | "approved" | "needs_changes" | "reviewed" | "withdrawn";

export interface ReviewItem {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  ticketId: string;
  ticketSummary: string;
  activeHtml: string;
  status: ReviewStatus;
  submittedAt: number;
  reviewedAt?: number;
  internalNotes?: string;
}

export interface SharedMock {
  id: string;
  shareId: string;
  sessionId: string;
  ticketId: string;
  ticketSummary: string;
  activeHtml: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
}

export interface MockAnchor {
  /** Region as percentages of the mock viewport (0–100). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Comment {
  id: string;
  targetId: string;
  authorName: string;
  authorId?: string;
  authorRole?: UserRole;
  text: string;
  createdAt: number;
  kind?: ReviewEventKind;
  anchor?: MockAnchor;
}

export type ReviewEventKind =
  | "message"
  | "submission"
  | "resubmission"
  | "approval"
  | "changes_requested"
  | "retraction";

export type EngagementType = "feedback" | "testimonial" | "feature_request";

export type FeatureRequestStatus =
  | "submitted"
  | "under_review"
  | "planned"
  | "in_progress"
  | "shipped"
  | "declined";

export interface UserEngagement {
  id: string;
  userId: string;
  sessionId: string;
  ticketId: string;
  type: EngagementType;
  rating?: "positive" | "negative";
  text?: string;
  title?: string;
  description?: string;
  priority?: "nice_to_have" | "important";
  showName?: boolean;
  requestStatus?: FeatureRequestStatus;
  createdAt: number;
}

export interface ReviewFilter {
  status?: ReviewStatus;
  userId?: string;
}

export interface EngagementFilter {
  sessionId?: string;
  ticketId?: string;
  userId?: string;
  type?: EngagementType;
}
