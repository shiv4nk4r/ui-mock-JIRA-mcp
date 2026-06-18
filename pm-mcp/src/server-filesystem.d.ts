declare module "@modelcontextprotocol/server-filesystem/dist/lib.js" {
  export function setAllowedDirectories(directories: string[]): void;
  export function getAllowedDirectories(): string[];
  export function validatePath(requestedPath: string): Promise<string>;
  export function readFileContent(filePath: string, encoding?: string): Promise<string>;
  export function writeFileContent(filePath: string, content: string): Promise<void>;
  export function getFileStats(filePath: string): Promise<Record<string, unknown>>;
  export function formatSize(bytes: number): string;
  export function tailFile(filePath: string, n: number): Promise<string>;
  export function headFile(filePath: string, n: number): Promise<string>;
  export function applyFileEdits(
    filePath: string,
    edits: Array<{ oldText: string; newText: string }>,
    dryRun: boolean
  ): Promise<string>;
  export function searchFilesWithValidation(
    path: string,
    pattern: string,
    allowedDirectories: string[],
    options?: { excludePatterns?: string[] }
  ): Promise<string[]>;
}

declare module "@modelcontextprotocol/server-filesystem/dist/path-utils.js" {
  export function expandHome(filepath: string): string;
  export function normalizePath(filepath: string): string;
}
