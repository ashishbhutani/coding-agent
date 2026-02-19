/**
 * read_file Tool
 *
 * Reads the contents of a file from the local filesystem.
 * Supports line range selection for viewing specific sections.
 */

import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";

export const readFileTool: Tool = {
    definition: {
        name: "read_file",
        description:
            "Read the contents of a file. Returns the file content with line numbers. " +
            "You can optionally specify a line range to read a specific section.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute or relative path to the file to read",
                },
                start_line: {
                    type: "integer",
                    description: "Optional start line number (1-indexed, inclusive)",
                },
                end_line: {
                    type: "integer",
                    description: "Optional end line number (1-indexed, inclusive)",
                },
            },
            required: ["path"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const filePath = resolve(String(args.path));
        const startLine = args.start_line ? Number(args.start_line) : undefined;
        const endLine = args.end_line ? Number(args.end_line) : undefined;

        try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) {
                return { output: `Error: "${filePath}" is not a file`, isError: true };
            }

            const content = await readFile(filePath, "utf-8");
            const lines = content.split("\n");
            const totalLines = lines.length;

            // Apply line range if specified
            const start = startLine ? Math.max(1, startLine) : 1;
            const end = endLine ? Math.min(totalLines, endLine) : totalLines;

            const selectedLines = lines.slice(start - 1, end);
            const numberedLines = selectedLines
                .map((line, i) => `${start + i}: ${line}`)
                .join("\n");

            const header = `File: ${filePath} (${totalLines} lines total, showing ${start}-${end})`;
            return { output: `${header}\n${numberedLines}` };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error reading file: ${msg}`, isError: true };
        }
    },
};
