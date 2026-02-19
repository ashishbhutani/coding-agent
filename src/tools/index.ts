/**
 * Tools Module - Barrel Export
 *
 * Registers all built-in tools and exports the registry.
 */

export { ToolRegistry } from "./registry.js";
export type { Tool, ToolExecutionResult } from "./registry.js";

import { ToolRegistry } from "./registry.js";
import { readFileTool } from "./read-file.js";
import { writeFileTool } from "./write-file.js";
import { editFileTool } from "./edit-file.js";
import { insertLinesTool } from "./insert-lines.js";
import { deleteLinesTool } from "./delete-lines.js";
import { grepSearchTool } from "./grep-search.js";
import { listDirTool } from "./list-dir.js";
import { runCommandTool } from "./run-command.js";

/**
 * Create a tool registry with all built-in tools registered.
 */
export function createToolRegistry(): ToolRegistry {
    const registry = new ToolRegistry();

    registry.register(readFileTool);
    registry.register(writeFileTool);
    registry.register(editFileTool);
    registry.register(insertLinesTool);
    registry.register(deleteLinesTool);
    registry.register(grepSearchTool);
    registry.register(listDirTool);
    registry.register(runCommandTool);

    return registry;
}

