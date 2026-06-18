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

export class RepoManager {
  private readonly clonePath: string;
  private readonly remoteUrl: string;
  private readonly defaultBranch: string;
  private readonly autoPull: boolean;
  private readonly useLocalOverride: boolean;
  private state: RepoState | null = null;
  private checkoutMutex: Promise<void> = Promise.resolve();

  constructor() {
    const cloneDir = process.env.REPO_CLONE_DIR ?? ".repos/manager-dashboard";
    this.useLocalOverride = Boolean(process.env.REPO_ROOT);
    this.clonePath = this.useLocalOverride
      ? path.resolve(process.env.REPO_ROOT!)
      : path.resolve(PM_MCP_ROOT, cloneDir);
    this.remoteUrl =
      process.env.REPO_URL ?? "git@github.com:greyorange/manager-dashboard.git";
    this.defaultBranch = process.env.REPO_DEFAULT_BRANCH ?? "develop";
    this.autoPull = process.env.REPO_AUTO_PULL !== "false";
  }

  getRepoRoot(): string {
    return this.clonePath;
  }

  getDefaultBranch(): string {
    return this.defaultBranch;
  }

  getCurrentState(): RepoState | null {
    return this.state;
  }

  private git(): SimpleGit {
    return simpleGit(this.clonePath);
  }

  private async readState(): Promise<RepoState> {
    const git = this.git();
    const branch = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
    const commit = (await git.revparse(["HEAD"])).trim();
    this.state = {
      branch,
      commit,
      lastSyncedAt: new Date().toISOString(),
      repoRoot: this.clonePath,
    };
    return this.state;
  }

  async ensureReady(): Promise<RepoState> {
    if (this.useLocalOverride) {
      if (!fs.existsSync(path.join(this.clonePath, ".git"))) {
        throw new Error(
          `REPO_ROOT is set to ${this.clonePath} but it is not a git repository.`
        );
      }
      console.log(`[repo] Using local checkout at ${this.clonePath}`);
      if (this.autoPull) {
        return this.withCheckoutLock(async () => {
          const git = this.git();
          await git.fetch("origin").catch(() => {});
          const current = (await git.revparse(["--abbrev-ref", "HEAD"])).trim();
          if (this.autoPull) {
            await git.pull("origin", current).catch(() => {});
          }
          return this.readState();
        });
      }
      return this.readState();
    }

    if (!fs.existsSync(path.join(this.clonePath, ".git"))) {
      console.log(`[repo] Cloning ${this.remoteUrl} → ${this.clonePath}`);
      fs.mkdirSync(path.dirname(this.clonePath), { recursive: true });
      await simpleGit().clone(this.remoteUrl, this.clonePath, [
        "--branch",
        this.defaultBranch,
      ]);
    }

    return this.withCheckoutLock(async () => {
      const git = this.git();
      console.log(`[repo] Fetching origin…`);
      await git.fetch("origin");
      await git.checkout(this.defaultBranch);
      if (this.autoPull) {
        console.log(`[repo] Pulling ${this.defaultBranch}…`);
        await git.pull("origin", this.defaultBranch);
      }
      const state = await this.readState();
      console.log(`[repo] Ready on ${state.branch} @ ${state.commit.slice(0, 7)}`);
      return state;
    });
  }

  async switchBranch(branch: string, forcePull = true): Promise<RepoState> {
    return this.withCheckoutLock(async () => {
      const git = this.git();
      await git.fetch("origin");

      const branches = await git.branch(["-a"]);
      const remoteBranch = `origin/${branch}`;
      const hasRemote = branches.all.includes(remoteBranch);
      const hasLocal = branches.all.includes(branch);

      if (!hasLocal && !hasRemote) {
        throw new Error(`Branch "${branch}" not found locally or on origin`);
      }

      if (hasLocal) {
        await git.checkout(branch);
      } else {
        await git.checkout(["-B", branch, remoteBranch]);
      }

      if (forcePull) {
        await git.pull("origin", branch).catch(() => {});
      }

      const state = await this.readState();
      console.log(
        `[repo] Switched to ${state.branch} @ ${state.commit.slice(0, 7)}`
      );
      return state;
    });
  }

  async listBranches(): Promise<string[]> {
    const git = this.git();
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
