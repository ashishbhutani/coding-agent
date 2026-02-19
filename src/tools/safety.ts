/**
 * Safety Guardrails
 *
 * Prevents the agent from destroying its own source code,
 * deleting critical files, or running dangerous commands.
 */

import { resolve, relative } from "node:path";
import { cwd } from "node:process";

/**
 * Paths relative to project root that the agent must NEVER overwrite or delete.
 * The agent can still READ these files.
 */
const PROTECTED_PATTERNS = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".gitignore",
    ".env",
    ".env.example",
    "node_modules",
];

/**
 * Source directories the agent must not wipe entirely
 * (individual file edits within these are allowed).
 */
const PROTECTED_DIRS = [
    "src/",
    ".agent/",
];

/**
 * Commands or patterns that should be blocked entirely.
 */
const DANGEROUS_COMMAND_PATTERNS = [
    /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s+).*src\b/,     // rm -rf src or similar
    /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s+).*package\.json/,
    /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s+).*node_modules\b/,
    /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s+)\.\s*$/,       // rm -rf .
    /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s+)\/\s*$/,       // rm -rf /
    />\s*(package\.json|tsconfig\.json|\.gitignore)/,      // redirect overwrite critical files
];

/**
 * Check if a file path is a protected project file that should not be overwritten
 * by the agent using write_file (full overwrite). edit_file is still allowed.
 */
export function isProtectedPath(filePath: string): boolean {
    const absPath = resolve(filePath);
    const relPath = relative(cwd(), absPath);

    // Don't allow writing outside project root
    if (relPath.startsWith("..")) {
        return false; // allow writing outside project (e.g. /tmp)
    }

    return PROTECTED_PATTERNS.some((pattern) => relPath === pattern);
}

/**
 * Check if a command is too dangerous to execute.
 * Returns a reason string if dangerous, null if safe.
 */
export function isDangerousCommand(command: string): string | null {
    for (const pattern of DANGEROUS_COMMAND_PATTERNS) {
        if (pattern.test(command)) {
            return `Blocked: "${command}" matches dangerous pattern ${pattern}. This could destroy critical project files.`;
        }
    }
    return null;
}

/**
 * Check if a path would delete/overwrite an entire protected source directory.
 * Individual files within the directory are fine — only blocking wholesale deletion.
 */
export function isProtectedDirectory(dirPath: string): boolean {
    const absPath = resolve(dirPath);
    const relPath = relative(cwd(), absPath);

    return PROTECTED_DIRS.some(
        (dir) => relPath === dir.replace(/\/$/, "") || relPath + "/" === dir
    );
}
