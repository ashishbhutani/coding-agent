/**
 * Safety Guardrails
 *
 * Two core rules:
 * 1. NO DELETIONS — any rm, unlink, rmdir, or destructive command is blocked.
 * 2. DIRECTORY SANDBOX — all file writes/edits must stay within the agent's
 *    working directory. No touching files outside the project.
 */

import { resolve, relative } from "node:path";
import { cwd } from "node:process";

// ── Rule 1: Block all delete operations ────────────────────

/**
 * Command patterns that perform deletion or destructive operations.
 */
const DELETE_COMMAND_PATTERNS = [
    /\brm\b/,                     // rm in any form
    /\bunlink\b/,                  // unlink
    /\brmdir\b/,                   // rmdir
    /\bshred\b/,                   // shred (secure delete)
    />\s*\/dev\/null/,             // redirect to /dev/null (data loss)
    />\s+\S+\.ts\b/,              // redirect overwrite .ts files
    />\s+\S+\.json\b/,            // redirect overwrite .json files
    /\btruncate\b/,                // truncate files
    /\bgit\s+clean\b/,            // git clean (removes untracked files)
    /\bgit\s+checkout\s+--\s+\./,  // git checkout -- . (discards all changes)
    /\bgit\s+reset\s+--hard\b/,   // git reset --hard (discards commits + changes)
];

/**
 * Check if a command performs any deletion or destructive operation.
 * Returns a reason string if blocked, null if safe.
 */
export function isDangerousCommand(command: string): string | null {
    for (const pattern of DELETE_COMMAND_PATTERNS) {
        if (pattern.test(command)) {
            return (
                `Blocked: "${command}" contains a destructive operation (matched: ${pattern}).\n` +
                `The agent is not allowed to delete files or run destructive commands.\n` +
                `If you need to delete something, ask the user to do it manually.`
            );
        }
    }
    return null;
}

// ── Rule 2: Directory sandboxing ───────────────────────────

/** Cache the working directory at module load time. */
const PROJECT_ROOT = cwd();

/**
 * Check if a file path is within the agent's working directory.
 * Returns true if the path is safe (inside project), false if outside.
 */
export function isWithinWorkingDirectory(filePath: string): boolean {
    const absPath = resolve(filePath);
    const relPath = relative(PROJECT_ROOT, absPath);

    // If relative path starts with "..", it's outside the project
    if (relPath.startsWith("..") || relPath.startsWith("/")) {
        return false;
    }

    return true;
}

/**
 * Check if a file path is outside the sandbox.
 * Returns a reason string if blocked, null if allowed.
 */
export function checkPathSandbox(filePath: string): string | null {
    if (!isWithinWorkingDirectory(filePath)) {
        const absPath = resolve(filePath);
        return (
            `Blocked: "${absPath}" is outside the project directory (${PROJECT_ROOT}).\n` +
            `The agent can only create, modify, or delete files within the project.`
        );
    }
    return null;
}

// ── Protected config files ─────────────────────────────────

/**
 * Paths relative to project root that write_file must NOT overwrite.
 * edit_file is still allowed for these (surgical edits are fine).
 */
const PROTECTED_WRITE_TARGETS = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".gitignore",
    ".env",
    ".env.example",
    "node_modules",
];

/**
 * Check if a file path is a protected config file that write_file should not overwrite.
 * edit_file can still modify these files surgically.
 */
export function isProtectedFromOverwrite(filePath: string): boolean {
    const absPath = resolve(filePath);
    const relPath = relative(PROJECT_ROOT, absPath);

    return PROTECTED_WRITE_TARGETS.some((pattern) => relPath === pattern);
}

/**
 * Full safety check for file write operations (write_file).
 * Returns a reason string if blocked, null if allowed.
 */
export function checkWriteSafety(filePath: string): string | null {
    // Check sandbox first
    const sandboxIssue = checkPathSandbox(filePath);
    if (sandboxIssue) return sandboxIssue;

    // Check protected files
    if (isProtectedFromOverwrite(filePath)) {
        const absPath = resolve(filePath);
        return (
            `Blocked: "${absPath}" is a protected config file.\n` +
            `Use edit_file to make surgical changes instead of overwriting.`
        );
    }

    return null;
}

/**
 * Full safety check for file edit operations (edit_file, insert_lines, delete_lines).
 * Only checks sandbox — editing protected files is allowed.
 * Returns a reason string if blocked, null if allowed.
 */
export function checkEditSafety(filePath: string): string | null {
    return checkPathSandbox(filePath);
}
