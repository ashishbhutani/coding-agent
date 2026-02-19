/**
 * Tests for Summarizer and agent history summarization
 */

import { describe, it, expect, vi } from "vitest";
import { Agent } from "./agent.js";
import { ToolRegistry } from "../tools/registry.js";
import type { LLMProvider, LLMMessage, LLMResponse, ToolDefinition } from "../llm/provider.js";
import type { Tool } from "../tools/registry.js";
import type { Summarizer } from "./summarizer.js";

/**
 * Create a mock LLM provider with predefined responses.
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

/** Create a mock summarizer that returns a canned summary. */
function mockSummarizer(summary: string): Summarizer {
    return {
        summarize: vi.fn().mockResolvedValue(summary),
    } as unknown as Summarizer;
}

/** Create a mock summarizer that throws an error. */
function failingSummarizer(): Summarizer {
    return {
        summarize: vi.fn().mockRejectedValue(new Error("API down")),
    } as unknown as Summarizer;
}

describe("Summarizer integration", () => {
    it("should summarize old history when summarizer is provided", async () => {
        // Create enough tool rounds to exceed historyWindowSize (set to 2)
        const responses: LLMResponse[] = [];

        // 4 tool rounds with different args (no repetition detection)
        for (let i = 0; i < 4; i++) {
            responses.push({
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: `msg-${i}` } },
                ],
                finishReason: "tool_calls",
            });
        }

        // Final text response
        responses.push({
            content: "All done!",
            toolCalls: [],
            finishReason: "stop",
        });

        const provider = mockProvider(responses);
        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        const summarizer = mockSummarizer("User asked to echo 4 messages. Agent echoed them all.");

        const agent = new Agent(
            provider,
            tools,
            { verbose: false, historyWindowSize: 2 },
            summarizer
        );

        const response = await agent.processMessage("Echo some things");

        expect(response).toBe("All done!");
        // Summarizer should have been called at least once
        expect(summarizer.summarize).toHaveBeenCalled();
    });

    it("should fall back to truncation when summarizer fails", async () => {
        // 4 tool rounds to exceed window
        const responses: LLMResponse[] = [];
        for (let i = 0; i < 4; i++) {
            responses.push({
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: `msg-${i}` } },
                ],
                finishReason: "tool_calls",
            });
        }
        responses.push({
            content: "Done despite error",
            toolCalls: [],
            finishReason: "stop",
        });

        const provider = mockProvider(responses);
        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        const summarizer = failingSummarizer();

        const agent = new Agent(
            provider,
            tools,
            { verbose: false, historyWindowSize: 2 },
            summarizer
        );

        const response = await agent.processMessage("Echo things");

        // Should still complete despite summarizer failure
        expect(response).toBe("Done despite error");
        expect(summarizer.summarize).toHaveBeenCalled();
    });

    it("should not summarize when history is within window size", async () => {
        // Only 1 tool round — under historyWindowSize of 6
        const responses: LLMResponse[] = [
            {
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: "hello" } },
                ],
                finishReason: "tool_calls",
            },
            {
                content: "Done!",
                toolCalls: [],
                finishReason: "stop",
            },
        ];

        const provider = mockProvider(responses);
        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        const summarizer = mockSummarizer("Should not be called");

        const agent = new Agent(
            provider,
            tools,
            { verbose: false },
            summarizer
        );

        await agent.processMessage("Quick task");

        // Summarizer should NOT have been called — within window
        expect(summarizer.summarize).not.toHaveBeenCalled();
    });

    it("should work without a summarizer (truncation only)", async () => {
        // 4 tool rounds, no summarizer
        const responses: LLMResponse[] = [];
        for (let i = 0; i < 4; i++) {
            responses.push({
                content: "",
                toolCalls: [
                    { name: "echo", arguments: { message: `msg-${i}` } },
                ],
                finishReason: "tool_calls",
            });
        }
        responses.push({
            content: "Completed!",
            toolCalls: [],
            finishReason: "stop",
        });

        const provider = mockProvider(responses);
        const tools = new ToolRegistry();
        tools.register(makeEchoTool());

        // No summarizer passed
        const agent = new Agent(
            provider,
            tools,
            { verbose: false, historyWindowSize: 2 }
        );

        const response = await agent.processMessage("Echo things");
        expect(response).toBe("Completed!");
    });
});
