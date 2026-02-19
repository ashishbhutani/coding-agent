/**
 * write_file Tool
 *
 * Creates or overwrites a file with the given content.
 * Creates parent directories if they don't exist.
 * Blocks overwriting protected project config files.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";
import { isProtectedPath } from "./safety.js";

export const writeFileTool: Tool = {
    definition: {
        name: "write_file",
        description:
            "Write content to a file. Creates the file if it doesn't exist, " +
            "or overwrites it if it does. Parent directories are created automatically. " +
            "NOTE: Cannot overwrite protected config files (package.json, tsconfig.json, etc.) — use edit_file instead.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute or relative path to the file to write",
                },
                content: {
                    type: "string",
                    description: "The content to write to the file",
                },
            },
            required: ["path", "content"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const filePath = resolve(String(args.path));
        const content = String(args.content);

        // Safety: block overwriting protected files
        if (isProtectedPath(filePath)) {
            return {
                output: `Blocked: "${filePath}" is a protected project file. Use edit_file to make changes instead of overwriting.`,
                isError: true,
            };
        }

        try {
            // Ensure parent directory exists
            await mkdir(dirname(filePath), { recursive: true });

            await writeFile(filePath, content, "utf-8");

            const lineCount = content.split("\n").length;
            return {
                output: `Successfully wrote ${lineCount} lines to ${filePath}`,
            };
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error writing file: ${msg}`, isError: true };
        }
    },
};

