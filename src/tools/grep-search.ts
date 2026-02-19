/**
 * grep_search Tool
 *
 * Searches for a pattern in files within a directory.
 * Uses Node.js built-in filesystem APIs (no external dependencies).
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";

interface GrepMatch {
    file: string;
    line: number;
    content: string;
}

const MAX_RESULTS = 50;
const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    "dist",
    ".next",
    "__pycache__",
    ".venv",
    "venv",
    ".agent",
]);

async function searchDirectory(
    dirPath: string,
    pattern: RegExp,
    basePath: string,
    results: GrepMatch[]
): Promise<void> {
    if (results.length >= MAX_RESULTS) return;

    let entries;
    try {
        entries = await readdir(dirPath, { withFileTypes: true });
    } catch {
        return; // Skip directories we can't read
    }

    for (const entry of entries) {
        if (results.length >= MAX_RESULTS) return;

        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
            if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
                await searchDirectory(fullPath, pattern, basePath, results);
            }
        } else if (entry.isFile()) {
            // Skip binary files (check by extension)
            const ext = entry.name.split(".").pop()?.toLowerCase() || "";
            const binaryExts = new Set([
                "png", "jpg", "jpeg", "gif", "bmp", "ico",
                "woff", "woff2", "ttf", "eot",
                "zip", "tar", "gz", "bz2",
                "pdf", "doc", "docx",
                "exe", "dll", "so", "dylib",
            ]);
            if (binaryExts.has(ext)) continue;

            try {
                const fileStat = await stat(fullPath);
                // Skip files larger than 1MB
                if (fileStat.size > 1_000_000) continue;

                const content = await readFile(fullPath, "utf-8");
                const lines = content.split("\n");

                for (let i = 0; i < lines.length && results.length < MAX_RESULTS; i++) {
                    if (pattern.test(lines[i])) {
                        results.push({
                            file: relative(basePath, fullPath),
                            line: i + 1,
                            content: lines[i].trim(),
                        });
                    }
                }
            } catch {
                // Skip files we can't read
            }
        }
    }
}

export const grepSearchTool: Tool = {
    definition: {
        name: "grep_search",
        description:
            "Search for a text pattern in files within a directory. " +
            "Returns matching lines with file paths and line numbers. " +
            "Results are capped at 50 matches. Ignores node_modules, .git, dist.",
        parameters: {
            type: "object",
            properties: {
                pattern: {
                    type: "string",
                    description: "The text pattern to search for (literal string or regex)",
                },
                path: {
                    type: "string",
                    description:
                        "Directory to search in (defaults to current directory)",
                },
                is_regex: {
                    type: "boolean",
                    description: "If true, treat pattern as a regular expression",
                },
                case_insensitive: {
                    type: "boolean",
                    description: "If true, perform case-insensitive search",
                },
            },
            required: ["pattern"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const searchPath = resolve(String(args.path || "."));
        const patternStr = String(args.pattern);
        const isRegex = Boolean(args.is_regex);
        const caseInsensitive = Boolean(args.case_insensitive);

        try {
            const pathStat = await stat(searchPath);
            if (!pathStat.isDirectory()) {
                return {
                    output: `Error: "${searchPath}" is not a directory`,
                    isError: true,
                };
            }

            const flags = caseInsensitive ? "gi" : "g";
            const pattern = isRegex
                ? new RegExp(patternStr, flags)
                : new RegExp(patternStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);

            const results: GrepMatch[] = [];
            await searchDirectory(searchPath, pattern, searchPath, results);

            if (results.length === 0) {
                return { output: `No matches found for "${patternStr}" in ${searchPath}` };
            }

            const output = results
                .map((r) => `${r.file}:${r.line}: ${r.content}`)
                .join("\n");

            const header =
                results.length >= MAX_RESULTS
                    ? `Found ${MAX_RESULTS}+ matches (showing first ${MAX_RESULTS}):`
                    : `Found ${results.length} match(es):`;

            return { output: `${header}\n${output}` };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error searching: ${msg}`, isError: true };
        }
    },
};
