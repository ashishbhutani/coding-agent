/**
 * edit_file Tool
 *
 * Surgically edit a file using either:
 *   1. Search & Replace — find exact text, replace with new text (preferred)
 *   2. Line Range Replace — replace lines N through M with new content
 *
 * Search & Replace validates that old_text appears exactly once.
 * On 0 or 2+ matches, it fails with a helpful error message.
 */

import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import type { Tool, ToolExecutionResult } from "./registry.js";

export const editFileTool: Tool = {
    definition: {
        name: "edit_file",
        description:
            "Edit an existing file by replacing specific content. Supports two modes:\n" +
            "1. Search & Replace (preferred): Provide `old_text` and `new_text` to find and replace exact text.\n" +
            "2. Line Range: Provide `start_line`, `end_line`, and `new_text` to replace a range of lines.\n" +
            "Always read_file first to get exact text before editing.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "Absolute or relative path to the file to edit",
                },
                old_text: {
                    type: "string",
                    description:
                        "The exact text to search for and replace (including whitespace/indentation). " +
                        "Must match exactly once in the file.",
                },
                new_text: {
                    type: "string",
                    description: "The replacement text",
                },
                start_line: {
                    type: "integer",
                    description: "Start line number for line-range mode (1-indexed, inclusive)",
                },
                end_line: {
                    type: "integer",
                    description: "End line number for line-range mode (1-indexed, inclusive)",
                },
            },
            required: ["path", "new_text"],
        },
    },

    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
        const filePath = resolve(String(args.path));
        const newText = String(args.new_text);
        const oldText = args.old_text != null ? String(args.old_text) : undefined;
        const startLine = args.start_line != null ? Number(args.start_line) : undefined;
        const endLine = args.end_line != null ? Number(args.end_line) : undefined;

        try {
            // Validate file exists and is a file
            const fileStat = await stat(filePath);
            if (!fileStat.isFile()) {
                return { output: `Error: "${filePath}" is not a file`, isError: true };
            }

            const content = await readFile(filePath, "utf-8");

            let updatedContent: string;

            if (oldText != null) {
                // ── Mode 1: Search & Replace ──
                updatedContent = searchAndReplace(content, oldText, newText, filePath);
            } else if (startLine != null && endLine != null) {
                // ── Mode 2: Line Range Replace ──
                updatedContent = lineRangeReplace(content, startLine, endLine, newText, filePath);
            } else {
                return {
                    output:
                        "Error: Must provide either `old_text` (search & replace) or " +
                        "`start_line` + `end_line` (line range replace).",
                    isError: true,
                };
            }

            await writeFile(filePath, updatedContent, "utf-8");

            const oldLines = content.split("\n").length;
            const newLines = updatedContent.split("\n").length;
            const diff = newLines - oldLines;
            const diffStr = diff === 0 ? "same line count" : diff > 0 ? `+${diff} lines` : `${diff} lines`;

            return {
                output: `Successfully edited ${filePath} (${diffStr}, now ${newLines} lines total)`,
            };
        } catch (error: unknown) {
            if (error instanceof EditError) {
                return { output: error.message, isError: true };
            }
            const msg = error instanceof Error ? error.message : String(error);
            return { output: `Error editing file: ${msg}`, isError: true };
        }
    },
};

/** Custom error type for edit-specific validation failures. */
class EditError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EditError";
    }
}

/**
 * Search & Replace: find exact `oldText` in `content` and replace with `newText`.
 * Throws EditError if oldText is not found or found multiple times.
 */
function searchAndReplace(
    content: string,
    oldText: string,
    newText: string,
    filePath: string
): string {
    // Count occurrences
    let count = 0;
    let searchFrom = 0;
    while (true) {
        const idx = content.indexOf(oldText, searchFrom);
        if (idx === -1) break;
        count++;
        searchFrom = idx + 1;
    }

    if (count === 0) {
        // Provide helpful context: show a snippet of what the file looks like
        const preview = content.slice(0, 200).replace(/\n/g, "\\n");
        throw new EditError(
            `Edit failed: old_text not found in ${filePath}.\n` +
            `Make sure the text matches exactly (including whitespace and indentation).\n` +
            `File starts with: "${preview}..."`
        );
    }

    if (count > 1) {
        throw new EditError(
            `Edit failed: old_text found ${count} times in ${filePath}.\n` +
            `Provide more surrounding context in old_text to make it unique.`
        );
    }

    // Exactly one match — replace it
    return content.replace(oldText, newText);
}

/**
 * Line Range Replace: replace lines startLine..endLine with newText.
 */
function lineRangeReplace(
    content: string,
    startLine: number,
    endLine: number,
    newText: string,
    filePath: string
): string {
    const lines = content.split("\n");
    const totalLines = lines.length;

    if (startLine < 1 || endLine < startLine || startLine > totalLines) {
        throw new EditError(
            `Edit failed: invalid line range ${startLine}-${endLine} ` +
            `(file has ${totalLines} lines).`
        );
    }

    const clampedEnd = Math.min(endLine, totalLines);

    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(clampedEnd);
    const newLines = newText.length > 0 ? newText.split("\n") : [];

    return [...before, ...newLines, ...after].join("\n");
}
