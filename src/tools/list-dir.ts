/**
 * list_dir Tool
 *
 * Lists the contents of a directory with type and size information.
 */

import { readdir, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist"]);

export const listDirTool: Tool = {
    definition: {
        name: "list_dir",
        description:
            "List the contents of a directory. Shows file/directory names, types, " +
            "and sizes. Ignores node_modules, .git, and dist by default.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Path to the directory to list (defaults to current directory)",
                },
                show_hidden: {
                    type: "boolean",
                    description: "If true, show hidden files (starting with .)",
                },
            },
            required: [],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const dirPath = resolve(String(args.path || "."));
        const showHidden = Boolean(args.show_hidden);

        try {
            const dirStat = await stat(dirPath);
            if (!dirStat.isDirectory()) {
                return {
                    output: `Error: "${dirPath}" is not a directory`,
                    isError: true,
                };
            }

            const entries = await readdir(dirPath, { withFileTypes: true });

            const lines: string[] = [`Directory: ${dirPath}\n`];

            // Sort: directories first, then files, alphabetically
            const sorted = entries
                .filter((e) => {
                    if (!showHidden && e.name.startsWith(".")) return false;
                    if (e.isDirectory() && IGNORED_DIRS.has(e.name)) return false;
                    return true;
                })
                .sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory()) return -1;
                    if (!a.isDirectory() && b.isDirectory()) return 1;
                    return a.name.localeCompare(b.name);
                });

            for (const entry of sorted) {
                const fullPath = join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    lines.push(`📁 ${entry.name}/`);
                } else {
                    try {
                        const fileStat = await stat(fullPath);
                        const size = formatSize(fileStat.size);
                        lines.push(`📄 ${entry.name} (${size})`);
                    } catch {
                        lines.push(`📄 ${entry.name}`);
                    }
                }
            }

            if (sorted.length === 0) {
                lines.push("(empty directory)");
            }

            return { output: lines.join("\n") };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error listing directory: ${msg}`, isError: true };
        }
    },
};

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
