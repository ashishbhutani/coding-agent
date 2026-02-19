/**
 * Tool Registry
 *
 * Central registry for all agent tools. Each tool has a name, description,
 * JSON Schema parameters, and an execute function.
 */

import type { ToolDefinition } from "../llm/provider.js";

export interface ToolExecutionResult {
    output: string;
    isError?: boolean;
}

export interface Tool {
    definition: ToolDefinition;
    execute(args: Record<string, unknown>): Promise<ToolExecutionResult>;
}

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    register(tool: Tool): void {
        this.tools.set(tool.definition.name, tool);
    }

    get(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAll(): Tool[] {
        return Array.from(this.tools.values());
    }

    getDefinitions(): ToolDefinition[] {
        return this.getAll().map((t) => t.definition);
    }

    has(name: string): boolean {
        return this.tools.has(name);
    }

    listNames(): string[] {
        return Array.from(this.tools.keys());
    }

    async execute(
        name: string,
        args: Record<string, unknown>
    ): Promise<ToolExecutionResult> {
        const tool = this.tools.get(name);
        if (!tool) {
            return {
                output: `Error: Unknown tool "${name}". Available tools: ${this.listNames().join(", ")}`,
                isError: true,
            };
        }

        try {
            return await tool.execute(args);
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            return {
                output: `Error executing tool "${name}": ${message}`,
                isError: true,
            };
        }
    }
}
