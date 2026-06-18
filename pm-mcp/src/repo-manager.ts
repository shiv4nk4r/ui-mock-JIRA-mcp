import fs from "fs";
import path from "path";
import simpleGit, { SimpleGit } from "simple-git";
import { PM_MCP_ROOT } from "./paths";

export interface RepoState {
  branch: string;
  commit: string;
  lastSyncedAt: string;
  repoRoot: string;
}

/** Sanitize branch name for use as a directory name under .repos/worktrees/ */
export function safeBranchDir(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export class RepoManager {
  private readonly mainRepoPath: string;
  private readonly worktreesDir: string;
  private readonly remoteUrl: string;
  private readonly defaultBranch: string;
  private readonly autoPull: boolean;
  private readonly useLocalOverride: boolean;
  private activeRoot: string;
  private state: RepoState | null = null;
  private checkoutMutex: Promise<void> = Promise.resolve();

  constructor() {
    const cloneDir = process.env.REPO_CLONE_DIR ?? ".repos/manager-dashboard";
    this.useLocalOverride = Boolean(process.env.REPO_ROOT);
    this.mainRepoPath = this.useLocalOverride
      ? path.resolve(process.env.REPO_ROOT!)
      : path.resolve(PM_MCP_ROOT, cloneDir);
    this.worktreesDir = path.join(PM_MCP_ROOT, ".repos/worktrees");
    this.activeRoot = this.mainRepoPath;
    this.remoteUrl =
      process.env.REPO_URL ?? "git@github.com:greyorange/manager-dashboard.git";
    this.defaultBranch = process.env.REPO_DEFAULT_BRANCH ?? "develop";
    this.autoPull = process.env.REPO_AUTO_PULL !== "false";
  }

  /** Active checkout path — source files for the current branch live here. */
  getRepoRoot(): string {
    return this.activeRoot;
  }

  getMainRepoPath(): string {
    return this.mainRepoPath;
  }

  getWorktreesDir(): string {
    return this.worktreesDir;
  }

  getDefaultBranch(): string {
    return this.defaultBranch;
  }

  getCurrentState(): RepoState | null {
    return this.state;
  }

  /** Checkout path for a branch (default branch → main clone, others → worktree). */
  checkoutPathForBranch(branch: string): string {
    if (branch === this.defaultBranch) return this.mainRepoPath;
    return path.join(this.worktreesDir, safeBranchDir(branch));
  }

  private gitAt(root: string): SimpleGit {
    return simpleGit(root);
  }

  private async readState(root: string): Promise<RepoState> {
    const git = this.gitAt(root);
    const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    const commit = (await git.revparse(["HEAD"])).trim();
    this.activeRoot = root;
    this.state = {
      branch,
      commit,
      lastSyncedAt: new Date().toISOString(),
      repoRoot: root,
    };
    return this.state;
  }

  private isGitCheckout(dir: string): boolean {
    return (
      fs.existsSync(path.join(dir, ".git")) ||
      fs.existsSync(path.join(dir, "mdui")) ||
      fs.existsSync(path.join(dir, "mdbff"))
    );
  }

  private async ensureMainRepoExists(): Promise<void> {
    if (this.useLocalOverride) {
      if (!fs.existsSync(path.join(this.mainRepoPath, ".git"))) {
        throw new Error(
          `REPO_ROOT is set to ${this.mainRepoPath} but it is not a git repository.`
        );
      }
      return;
    }

    if (!fs.existsSync(path.join(this.mainRepoPath, ".git"))) {
      console.log(`[repo] Cloning ${this.remoteUrl} → ${this.mainRepoPath}`);
      fs.mkdirSync(path.dirname(this.mainRepoPath), { recursive: true });
      await simpleGit().clone(this.remoteUrl, this.mainRepoPath, [
        "--branch",
        this.defaultBranch,
      ]);
    }
  }

  /**
   * Ensure a checkout exists for `branch` and return its path.
   * Default branch uses the main clone; other branches get persistent git worktrees
   * under pm-mcp/.repos/worktrees/{branch}/ so source files are kept on disk.
   */
  private async ensureCheckout(branch: string, pull = this.autoPull): Promise<string> {
    return this.withCheckoutLock(async () => {
      return this.ensureCheckoutInternal(branch, pull);
    });
  }

  async ensureReady(): Promise<RepoState> {
    const checkoutPath = await this.ensureCheckout(this.defaultBranch);
    console.log(`[repo] Using checkout at ${checkoutPath}`);
    return this.readState(checkoutPath);
  }

  async switchBranch(branch: string, forcePull = true): Promise<RepoState> {
    return this.withCheckoutLock(async () => {
      const checkoutPath = await this.ensureCheckoutInternal(branch, forcePull);
      return this.readState(checkoutPath);
    });
  }

  /** Create or update a branch checkout (caller must hold checkout lock when needed). */
  private async ensureCheckoutInternal(
    branch: string,
    pull: boolean
  ): Promise<string> {
    await this.ensureMainRepoExists();
    const targetPath = this.checkoutPathForBranch(branch);

    if (targetPath === this.mainRepoPath) {
      const git = this.gitAt(this.mainRepoPath);
      await git.fetch("origin").catch(() => {});
      const current = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
      if (current !== branch) {
        await git.checkout(branch);
      }
      if (pull) {
        await git.pull("origin", branch).catch(() => {});
      }
      return targetPath;
    }

    if (this.isGitCheckout(targetPath)) {
      const git = this.gitAt(targetPath);
      await git.fetch("origin").catch(() => {});
      if (pull) {
        await git.pull("origin", branch).catch(() => {});
      }
      return targetPath;
    }

    fs.mkdirSync(this.worktreesDir, { recursive: true });
    const mainGit = this.gitAt(this.mainRepoPath);
    await mainGit.fetch("origin");

    const branches = await mainGit.branch(["-a"]);
    const remoteBranch = `origin/${branch}`;
    const hasRemote = branches.all.includes(remoteBranch);
    const hasLocal = branches.all.includes(branch);

    if (!hasLocal && !hasRemote) {
      throw new Error(`Branch "${branch}" not found locally or on origin`);
    }

    const ref = hasLocal ? branch : remoteBranch;
    console.log(`[repo] Creating worktree for ${branch} → ${targetPath}`);
    await mainGit.raw(["worktree", "add", "-B", branch, targetPath, ref]);

    if (pull) {
      await this.gitAt(targetPath).pull("origin", branch).catch(() => {});
    }

    return targetPath;
  }

  async listBranches(): Promise<string[]> {
    await this.ensureMainRepoExists();
    const git = this.gitAt(this.mainRepoPath);
    await git.fetch("origin").catch(() => {});
    const summary = await git.branch(["-r"]);
    return summary.all
      .filter((b) => b.startsWith("origin/") && !b.includes("HEAD"))
      .map((b) => b.replace(/^origin\//, ""))
      .sort();
  }

  private async withCheckoutLock<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prev = this.checkoutMutex;
    this.checkoutMutex = prev.then(() => gate);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}
