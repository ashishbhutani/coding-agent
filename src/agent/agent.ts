/**
 * Agent Loop
 *
 * The core agent loop that:
 * 1. Takes user input
 * 2. Sends it to the LLM with available tools
 * 3. Executes any tool calls the LLM makes
 * 4. Feeds results back to the LLM
 * 5. Repeats until the LLM responds with text (no more tool calls)
 */

import type { LLMProvider, LLMMessage, ToolResult } from "../llm/provider.js";
import type { ToolRegistry } from "../tools/registry.js";
import { buildSystemPrompt } from "./prompt-builder.js";
import chalk from "chalk";

export interface AgentConfig {
    maxToolRounds: number; // Max consecutive tool-calling rounds
    verbose: boolean; // Print tool calls and results
}

const DEFAULT_CONFIG: AgentConfig = {
    maxToolRounds: 25,
    verbose: true,
};

export class Agent {
    private provider: LLMProvider;
    private tools: ToolRegistry;
    private conversationHistory: LLMMessage[] = [];
    private config: AgentConfig;
    private systemPrompt: string;

    constructor(
        provider: LLMProvider,
        tools: ToolRegistry,
        config?: Partial<AgentConfig>
    ) {
        this.provider = provider;
        this.tools = tools;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.systemPrompt = buildSystemPrompt(tools.listNames());
    }

    /**
     * Process a user message through the agent loop.
     * Returns the final text response from the LLM.
     */
    async processMessage(userMessage: string): Promise<string> {
        // Add user message to history
        this.conversationHistory.push({
            role: "user",
            content: userMessage,
        });

        let toolRound = 0;

        while (toolRound < this.config.maxToolRounds) {
            // Send conversation to LLM
            const response = await this.provider.chat(
                this.conversationHistory,
                this.tools.getDefinitions(),
                this.systemPrompt
            );

            // Print usage stats
            if (response.usage && this.config.verbose) {
                console.log(
                    chalk.gray(
                        `  [tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out]`
                    )
                );
            }

            // If there are tool calls, execute them
            if (
                response.finishReason === "tool_calls" &&
                response.toolCalls.length > 0
            ) {
                toolRound++;

                // Add assistant message with tool calls to history
                this.conversationHistory.push({
                    role: "assistant",
                    content: response.content,
                    toolCalls: response.toolCalls,
                });

                // Execute each tool call
                const toolResults: ToolResult[] = [];

                for (const toolCall of response.toolCalls) {
                    if (this.config.verbose) {
                        console.log(
                            chalk.cyan(`\n  🔧 Tool: ${toolCall.name}`)
                        );
                        console.log(
                            chalk.gray(
                                `     Args: ${JSON.stringify(toolCall.arguments, null, 2).split("\n").join("\n     ")}`
                            )
                        );
                    }

                    const result = await this.tools.execute(
                        toolCall.name,
                        toolCall.arguments
                    );

                    if (this.config.verbose) {
                        const outputPreview =
                            result.output.length > 500
                                ? result.output.slice(0, 500) + "... (truncated)"
                                : result.output;
                        const color = result.isError ? chalk.red : chalk.green;
                        console.log(color(`     Result: ${outputPreview}`));
                    }

                    toolResults.push({
                        name: toolCall.name,
                        result: result.output,
                        isError: result.isError,
                    });
                }

                // Add tool results to history
                this.conversationHistory.push({
                    role: "tool",
                    content: "",
                    toolResults,
                });

                continue; // Loop back for the LLM's next response
            }

            // No tool calls — we have a final text response
            this.conversationHistory.push({
                role: "assistant",
                content: response.content,
            });

            return response.content;
        }

        return "⚠️ Agent reached maximum tool rounds without completing. The task may be too complex for a single interaction.";
    }

    /**
     * Reset conversation history (start fresh).
     */
    resetConversation(): void {
        this.conversationHistory = [];
    }

    /**
     * Get the current conversation length.
     */
    getConversationLength(): number {
        return this.conversationHistory.length;
    }
}
