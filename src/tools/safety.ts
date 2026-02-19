/**
 * Safety Guardrails
 *
 * Two core rules:
 * 1. DELETIONS require confirmation — any rm, unlink, rmdir, or destructive command asks the user.
 * 2. DIRECTORY SANDBOX — all file writes/edits must stay within the agent's working directory.
 *    Attempting to go outside asks the user for confirmation.
 *
 * Protected config files (package.json, etc.) require confirmation for write_file overwrite.
 */

import { resolve, relative } from "node:path";
import { cwd } from "node:process";
import { requestConfirmation } from "./confirmation.js";

// ── Dangerous command patterns ─────────────────────────

const DELETE_COMMAND_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\brm\b/, label: "rm (delete files)" },
    { pattern: /\bunlink\b/, label: "unlink (delete file)" },
    { pattern: /\brmdir\b/, label: "rmdir (delete directory)" },
    { pattern: /\bshred\b/, label: "shred (secure delete)" },
    { pattern: />\s*\/dev\/null/, label: "redirect to /dev/null" },
    { pattern: />\s+\S+\.ts\b/, label: "overwrite .ts file via redirect" },
    { pattern: />\s+\S+\.json\b/, label: "overwrite .json file via redirect" },
    { pattern: /\btruncate\b/, label: "truncate (empty file)" },
    { pattern: /\bgit\s+clean\b/, label: "git clean (remove untracked files)" },
    { pattern: /\bgit\s+checkout\s+--\s+\./, label: "git checkout -- . (discard all changes)" },
    { pattern: /\bgit\s+reset\s+--hard\b/, label: "git reset --hard (discard commits)" },
];

/**
 * Check if a command is dangerous and request user confirmation.
 * Returns null if safe or approved, error string if denied.
 */
export function checkCommandSafety(command: string): string | null {
    for (const { pattern, label } of DELETE_COMMAND_PATTERNS) {
        if (pattern.test(command)) {
            const approved = requestConfirmation(
                `⚠️  The agent wants to run a destructive command:\n` +
                `   Command: ${command}\n` +
                `   Reason:  ${label}\n`
            );

            if (approved) return null; // user said yes

            return (
                `Denied by user: "${command}" was flagged as destructive (${label}).\n` +
                `Ask the user to perform this action manually if needed.`
            );
        }
    }
    return null; // safe command, no confirmation needed
}

// ── Directory sandboxing ───────────────────────────────

const PROJECT_ROOT = cwd();

/**
 * Check if a path is within the project directory.
 */
export function isWithinWorkingDirectory(filePath: string): boolean {
    const absPath = resolve(filePath);
    const relPath = relative(PROJECT_ROOT, absPath);
    return !relPath.startsWith("..") && !relPath.startsWith("/");
}

/**
 * Check sandbox for a file path, requesting confirmation if outside project.
 * Returns null if safe/approved, error string if denied.
 */
export function checkPathSandbox(filePath: string): string | null {
    if (isWithinWorkingDirectory(filePath)) return null;

    const absPath = resolve(filePath);
    const approved = requestConfirmation(
        `⚠️  The agent wants to access a file outside the project:\n` +
        `   Path:    ${absPath}\n` +
        `   Project: ${PROJECT_ROOT}\n`
    );

    if (approved) return null;

    return (
        `Denied by user: "${absPath}" is outside the project directory (${PROJECT_ROOT}).\n` +
        `The agent can only access files within the project unless you approve.`
    );
}

// ── Protected config files ─────────────────────────────

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
 * Check if a file is protected from full overwrite via write_file.
 */
export function isProtectedFromOverwrite(filePath: string): boolean {
    const absPath = resolve(filePath);
    const relPath = relative(PROJECT_ROOT, absPath);
    return PROTECTED_WRITE_TARGETS.some((p) => relPath === p);
}

/**
 * Full safety check for write_file operations.
 * Checks sandbox + protected file, requesting confirmation as needed.
 */
export function checkWriteSafety(filePath: string): string | null {
    // Sandbox check (with confirmation)
    const sandboxIssue = checkPathSandbox(filePath);
    if (sandboxIssue) return sandboxIssue;

    // Protected file check (with confirmation)
    if (isProtectedFromOverwrite(filePath)) {
        const absPath = resolve(filePath);
        const approved = requestConfirmation(
            `⚠️  The agent wants to OVERWRITE a protected config file:\n` +
            `   File: ${absPath}\n` +
            `   Tip:  edit_file is usually safer for config changes.\n`
        );

        if (approved) return null;

        return (
            `Denied by user: "${absPath}" is a protected config file.\n` +
            `Use edit_file for surgical changes, or approve the overwrite.`
        );
    }

    return null;
}

/**
 * Full safety check for edit operations (edit_file, insert_lines, delete_lines).
 * Only checks sandbox — editing protected files is allowed.
 */
export function checkEditSafety(filePath: string): string | null {
    return checkPathSandbox(filePath);
}
