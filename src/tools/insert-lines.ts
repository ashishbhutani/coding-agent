/**
 * insert_lines Tool
 *
 * Insert content at a specific line position in a file.
 * Line 0 = prepend, -1 = append, N = insert before line N.
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";

export const insertLinesTool: Tool = {
    definition: {
        name: "insert_lines",
        description:
            "Insert content into a file at a specific line position. " +
            "Use line=0 to prepend at the beginning, line=-1 to append at the end, " +
            "or any positive number to insert before that line.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute or relative path to the file",
                },
                line: {
                    type: "integer",
                    description:
                        "Line number to insert before (1-indexed). " +
                        "Use 0 to prepend at start, -1 to append at end.",
                },
                content: {
                    type: "string",
                    description: "The content to insert",
                },
            },
            required: ["path", "line", "content"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const filePath = resolve(String(args.path));
        const lineNum = Number(args.line);
        const content = String(args.content);

        try {
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) {
                return { output: `Error: "${filePath}" is not a file`, isError: true };
            }

            const existing = await readFile(filePath, "utf-8");
            const lines = existing.split("\n");
            const insertLines = content.split("\n");
            const insertCount = insertLines.length;

            let result: string[];

            if (lineNum === 0) {
                // Prepend
                result = [...insertLines, ...lines];
            } else if (lineNum === -1) {
                // Append
                result = [...lines, ...insertLines];
            } else if (lineNum >= 1 && lineNum <= lines.length + 1) {
                // Insert before line N
                result = [
                    ...lines.slice(0, lineNum - 1),
                    ...insertLines,
                    ...lines.slice(lineNum - 1),
                ];
            } else {
                return {
                    output: `Error: line ${lineNum} is out of range (file has ${lines.length} lines, valid: 0, -1, or 1-${lines.length + 1})`,
                    isError: true,
                };
            }

            await writeFile(filePath, result.join("\n"), "utf-8");

            return {
                output: `Inserted ${insertCount} line(s) at position ${lineNum} in ${filePath} (now ${result.length} lines)`,
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error inserting lines: ${msg}`, isError: true };
        }
    },
};
