/**
 * Agent Loop
 *
 * The core agent loop that:
 * 1. Takes user input
 * 2. Sends it to the LLM with available tools
 * 3. Executes any tool calls the LLM makes
 * 4. Feeds results back to the LLM
 * 5. Repeats until the LLM responds with text (no more tool calls)
 *
 * Safety features:
 * - Repetition detection: stops if the same tool+args are called consecutively
 * - Max tool rounds: hard cap on consecutive tool-calling rounds
 * - Token optimization: prevents history bloat from repeated results
 */

import type { LLMProvider, LLMMessage, ToolResult } from "../llm/provider.js";
import type { ToolRegistry } from "../tools/registry.js";
import { buildSystemPrompt } from "./prompt-builder.js";
import chalk from "chalk";

export interface AgentConfig {
    maxToolRounds: number; // Max consecutive tool-calling rounds
    verbose: boolean; // Print tool calls and results
    maxRepetitions: number; // Max identical consecutive tool calls before stopping
}

const DEFAULT_CONFIG: AgentConfig = {
    maxToolRounds: 25,
    verbose: true,
    maxRepetitions: 2,
};

/** Fingerprint a tool call for repetition detection. */
function toolCallFingerprint(name: string, args: Record<string, unknown>): string {
    return `${name}::${JSON.stringify(args, Object.keys(args).sort())}`;
}

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

        // Repetition tracking: fingerprints of recent consecutive calls
        let lastFingerprint = "";
        let repetitionCount = 0;

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

                // ── Repetition detection ──
                // Build a combined fingerprint for all tool calls in this round
                const roundFingerprint = response.toolCalls
                    .map((tc) => toolCallFingerprint(tc.name, tc.arguments))
                    .join("|");

                if (roundFingerprint === lastFingerprint) {
                    repetitionCount++;

                    if (repetitionCount >= this.config.maxRepetitions) {
                        if (this.config.verbose) {
                            console.log(
                                chalk.yellow(
                                    `\n  ⚠️  Repetition detected: same tool call made ${repetitionCount + 1} times in a row. Stopping.`
                                )
                            );
                        }

                        // Inject a system message to force the LLM to respond with text
                        this.conversationHistory.push({
                            role: "user",
                            content:
                                "[SYSTEM] You are repeating the same tool calls. The task appears to be complete. " +
                                "Stop calling tools and provide your final response to the user summarizing what was accomplished.",
                        });

                        // One final LLM call to get a text response
                        const finalResponse = await this.provider.chat(
                            this.conversationHistory,
                            [], // No tools — force text response
                            this.systemPrompt
                        );

                        this.conversationHistory.push({
                            role: "assistant",
                            content: finalResponse.content,
                        });

                        return finalResponse.content;
                    }
                } else {
                    lastFingerprint = roundFingerprint;
                    repetitionCount = 0;
                }

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
