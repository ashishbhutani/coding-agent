/**
 * Tests for the Agent module
 */

import { describe, it, expect, vi } from "vitest";
import { Agent } from "./agent.js";
import { ToolRegistry } from "../tools/registry.js";
import type { LLMProvider, LLMMessage, LLMResponse, ToolDefinition } from "../llm/provider.js";
import type { Tool } from "../tools/registry.js";

/**
 * Create a mock LLM provider that returns predefined responses.
 */
function mockProvider(responses: LLMResponse[]): LLMProvider {
    let callIndex = 0;
    return {
        name: "mock",
        model: "mock-model",
        async chat(
            _messages: LLMMessage[],
            _tools?: ToolDefinition[],
            _systemPrompt?: string
        ): Promise<LLMResponse> {
            if (callIndex >= responses.length) {
                return {
                    content: "No more mock responses",
                    toolCalls: [],
                    finishReason: "stop",
                };
            }
            return responses[callIndex++];
        },
    };
}

function makeEchoTool(): Tool {
    return {
        definition: {
            name: "echo",
            description: "Echoes the input",
            parameters: {
                type: "object",
                properties: {
                    message: { type: "string", description: "Message to echo" },
                },
                required: ["message"],
            },
        },
        async execute(args) {
            return { output: `Echo: ${args.message}` };
        },
    };
}

describe("Agent", () => {
    it("should return text response when no tools are called", async () => {
        const provider = mockProvider([
            {
                content: "Hello! How can I help?",
                toolCalls: [],
                finishReason: "stop",
            },
        ]);

        const tools = new ToolRegistry();
        const agent = new Agent(provider, tools, { verbose: false });

        const response = await agent.processMessage("Hi");
        expect(response).toBe("Hello! How can I help?");
    });

    it("should execute tool calls and feed results back", async () => {
        const provider = mockProvider([
            // First response: LLM calls the echo tool
            {
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: "test123" } },
                ],
                finishReason: "tool_calls",
            },
            // Second response: LLM responds with final text
            {
                content: "The echo tool returned: Echo: test123",
                toolCalls: [],
                finishReason: "stop",
            },
        ]);

        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        const agent = new Agent(provider, tools, { verbose: false });
        const response = await agent.processMessage("Echo something");

        expect(response).toContain("Echo: test123");
    });

    it("should handle multiple sequential tool calls", async () => {
        const provider = mockProvider([
            {
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: "first" } },
                ],
                finishReason: "tool_calls",
            },
            {
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: "second" } },
                ],
                finishReason: "tool_calls",
            },
            {
                content: "Done! Called echo twice.",
                toolCalls: [],
                finishReason: "stop",
            },
        ]);

        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        const agent = new Agent(provider, tools, { verbose: false });
        const response = await agent.processMessage("Echo twice");

        expect(response).toContain("Done");
    });

    it("should stop after maxToolRounds", async () => {
        // Provider always returns tool calls — agent should bail out
        const provider = mockProvider(
            Array(30).fill({
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: "loop" } },
                ],
                finishReason: "tool_calls",
            })
        );

        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        const agent = new Agent(provider, tools, {
            verbose: false,
            maxToolRounds: 3,
        });
        const response = await agent.processMessage("Loop forever");

        expect(response).toContain("maximum tool rounds");
    });

    it("should track conversation length", async () => {
        const provider = mockProvider([
            { content: "Response 1", toolCalls: [], finishReason: "stop" },
            { content: "Response 2", toolCalls: [], finishReason: "stop" },
        ]);

        const tools = new ToolRegistry();
        const agent = new Agent(provider, tools, { verbose: false });

        expect(agent.getConversationLength()).toBe(0);

        await agent.processMessage("First message");
        expect(agent.getConversationLength()).toBe(2); // user + assistant

        await agent.processMessage("Second message");
        expect(agent.getConversationLength()).toBe(4);
    });

    it("should reset conversation", async () => {
        const provider = mockProvider([
            { content: "Hi", toolCalls: [], finishReason: "stop" },
        ]);

        const tools = new ToolRegistry();
        const agent = new Agent(provider, tools, { verbose: false });

        await agent.processMessage("Hello");
        expect(agent.getConversationLength()).toBe(2);

        agent.resetConversation();
        expect(agent.getConversationLength()).toBe(0);
    });
});
