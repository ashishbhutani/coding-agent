/**
 * delete_lines Tool
 *
 * Remove a range of lines from a file.
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";

export const deleteLinesTool: Tool = {
    definition: {
        name: "delete_lines",
        description:
            "Delete a range of lines from a file. " +
            "Lines are 1-indexed and both start and end are inclusive.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute or relative path to the file",
                },
                start_line: {
                    type: "integer",
                    description: "Start line number (1-indexed, inclusive)",
                },
                end_line: {
                    type: "integer",
                    description: "End line number (1-indexed, inclusive)",
                },
            },
            required: ["path", "start_line", "end_line"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const filePath = resolve(String(args.path));
        const startLine = Number(args.start_line);
        const endLine = Number(args.end_line);

        try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) {
                return { output: `Error: "${filePath}" is not a file`, isError: true };
            }

            const content = await readFile(filePath, "utf-8");
            const lines = content.split("\n");
            const totalLines = lines.length;

            if (startLine < 1 || endLine < startLine || startLine > totalLines) {
                return {
                    output: `Error: invalid line range ${startLine}-${endLine} (file has ${totalLines} lines)`,
                    isError: true,
                };
            }

            const clampedEnd = Math.min(endLine, totalLines);
            const deletedCount = clampedEnd - startLine + 1;

            const before = lines.slice(0, startLine - 1);
            const after = lines.slice(clampedEnd);
            const result = [...before, ...after];

            await writeFile(filePath, result.join("\n"), "utf-8");

            return {
                output: `Deleted ${deletedCount} line(s) from ${filePath} (was ${totalLines}, now ${result.length} lines)`,
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error deleting lines: ${msg}`, isError: true };
        }
    },
};
