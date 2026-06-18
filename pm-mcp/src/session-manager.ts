import { GraphStore } from "./parser/graph-store";
import {
  buildIndex,
  defaultConfig,
  tryLoadCache,
  cachePathForBranch,
} from "./parser/indexer";
import type { RepoManager } from "./repo-manager";

export interface SessionContext {
  sessionId: string;
  branch: string;
  commit: string;
  graph: GraphStore;
  indexReady: boolean;
  indexStatus: string;
  createdAt: number;
  lastAccessedAt: number;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export class SessionManager {
  private readonly sessions = new Map<string, SessionContext>();

  constructor(private readonly repoManager: RepoManager) {}

  createSession(sessionId: string): SessionContext {
    const repoState = this.repoManager.getCurrentState();
    if (!repoState) {
      throw new Error("RepoManager is not ready — call ensureReady() first");
    }

    const ctx: SessionContext = {
      sessionId,
      branch: repoState.branch,
      commit: repoState.commit,
      graph: new GraphStore(),
      indexReady: false,
      indexStatus: "Not yet indexed",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
    };

    this.sessions.set(ctx.sessionId, ctx);
    void this.ensureIndexed(ctx);
    return ctx;
  }

  getSession(sessionId: string): SessionContext | undefined {
    const ctx = this.sessions.get(sessionId);
    if (ctx) ctx.lastAccessedAt = Date.now();
    return ctx;
  }

  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  cleanupIdleSessions(): void {
    const now = Date.now();
    for (const [id, ctx] of this.sessions) {
      if (now - ctx.lastAccessedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }

  async warmBranchCache(branch: string, commit: string): Promise<void> {
    const repoRoot = this.repoManager.getRepoRoot();
    const cachePath = cachePathForBranch(branch);
    const probe = new GraphStore();
    const cached = tryLoadCache(probe, cachePath, { commit });

    if (cached.loaded) {
      console.log(
        `[index] Cache hit for ${branch} @ ${commit.slice(0, 7)} (${probe.stats().totalNodes} nodes)`
      );
      return;
    }

    console.log(`[index] Building cache for ${branch}…`);
    const graph = new GraphStore();
    const config = defaultConfig(repoRoot, branch);
    config.commit = commit;
    const result = await buildIndex(graph, config);
    console.log(
      `[index] Cache built for ${branch}: ${result.totalNodes} nodes in ${result.durationMs}ms`
    );
  }

  async ensureIndexed(ctx: SessionContext): Promise<void> {
    if (ctx.indexReady) return;

    const repoRoot = this.repoManager.getRepoRoot();
    const cachePath = cachePathForBranch(ctx.branch);
    const cacheResult = tryLoadCache(ctx.graph, cachePath, { commit: ctx.commit });

    if (cacheResult.loaded && cacheResult.meta) {
      const stats = ctx.graph.stats();
      ctx.indexReady = true;
      ctx.indexStatus = `Loaded from cache | ${stats.totalNodes} nodes | ${stats.totalEdges} edges`;
      return;
    }

    ctx.indexStatus = "Building index…";
    try {
      const config = defaultConfig(repoRoot, ctx.branch);
      config.commit = ctx.commit;
      const result = await buildIndex(ctx.graph, config);
      ctx.indexReady = true;
      ctx.indexStatus = `Indexed ${result.filesIndexed} files | ${result.totalNodes} nodes | ${result.totalEdges} edges | ${result.durationMs}ms`;
    } catch (e) {
      ctx.indexStatus = `Index error: ${(e as Error).message}`;
    }
  }

  async rebuildIndex(ctx: SessionContext): Promise<string> {
    ctx.graph.clear();
    ctx.indexReady = false;
    ctx.indexStatus = "Rebuilding…";

    const repoRoot = this.repoManager.getRepoRoot();
    const config = defaultConfig(repoRoot, ctx.branch);
    config.commit = ctx.commit;
    const result = await buildIndex(ctx.graph, config);
    ctx.indexReady = true;
    ctx.indexStatus = `Indexed ${result.filesIndexed} files | ${result.totalNodes} nodes | ${result.totalEdges} edges | ${result.durationMs}ms`;
    return ctx.indexStatus;
  }

  async switchBranch(
    ctx: SessionContext,
    branch: string,
    forcePull = true
  ): Promise<SessionContext> {
    const repoState = await this.repoManager.switchBranch(branch, forcePull);
    ctx.branch = repoState.branch;
    ctx.commit = repoState.commit;
    ctx.graph.clear();
    ctx.indexReady = false;
    ctx.indexStatus = "Switching branch…";
    await this.ensureIndexed(ctx);
    return ctx;
  }
}
