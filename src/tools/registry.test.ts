/**
 * Tests for the Tool Registry
 */

import { describe, it, expect } from "vitest";
import { ToolRegistry } from "./registry.js";
import type { Tool } from "./registry.js";

function makeDummyTool(name: string, output = "ok"): Tool {
    return {
        definition: {
            name,
            description: `Dummy tool: ${name}`,
            parameters: { type: "object", properties: {} },
        },
        async execute() {
            return { output };
        },
    };
}

describe("ToolRegistry", () => {
    it("should register and retrieve a tool", () => {
        const registry = new ToolRegistry();
        const tool = makeDummyTool("test_tool");
        registry.register(tool);

        expect(registry.has("test_tool")).toBe(true);
        expect(registry.get("test_tool")).toBe(tool);
    });

    it("should list all tool names", () => {
        const registry = new ToolRegistry();
        registry.register(makeDummyTool("alpha"));
        registry.register(makeDummyTool("beta"));
        registry.register(makeDummyTool("gamma"));

        expect(registry.listNames()).toEqual(["alpha", "beta", "gamma"]);
    });

    it("should return definitions for all tools", () => {
        const registry = new ToolRegistry();
        registry.register(makeDummyTool("tool_a"));
        registry.register(makeDummyTool("tool_b"));

        const defs = registry.getDefinitions();
        expect(defs).toHaveLength(2);
        expect(defs[0].name).toBe("tool_a");
        expect(defs[1].name).toBe("tool_b");
    });

    it("should execute a registered tool", async () => {
        const registry = new ToolRegistry();
        registry.register(makeDummyTool("my_tool", "hello world"));

        const result = await registry.execute("my_tool", {});
        expect(result.output).toBe("hello world");
        expect(result.isError).toBeUndefined();
    });

    it("should return error for unknown tool", async () => {
        const registry = new ToolRegistry();

        const result = await registry.execute("nonexistent", {});
        expect(result.isError).toBe(true);
        expect(result.output).toContain("Unknown tool");
    });

    it("should catch tool execution errors", async () => {
        const registry = new ToolRegistry();
        const failTool: Tool = {
            definition: {
                name: "fail_tool",
                description: "Always fails",
                parameters: { type: "object", properties: {} },
            },
            async execute() {
                throw new Error("Something broke!");
            },
        };
        registry.register(failTool);

        const result = await registry.execute("fail_tool", {});
        expect(result.isError).toBe(true);
        expect(result.output).toContain("Something broke!");
    });
});
