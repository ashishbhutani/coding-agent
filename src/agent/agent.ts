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
import type { Summarizer } from "./summarizer.js";
import { buildSystemPrompt } from "./prompt-builder.js";
import { CostTracker } from "./cost-tracker.js";
import chalk from "chalk";

export interface AgentConfig {
    maxToolRounds: number;
    verbose: boolean;
    maxRepetitions: number;
    /** Max full-detail tool result rounds to keep in history. Older ones get compressed. */
    historyWindowSize: number;
}

const DEFAULT_CONFIG: AgentConfig = {
    maxToolRounds: 25,
    verbose: true,
    maxRepetitions: 2,
    historyWindowSize: 6,
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
    private costTracker: CostTracker;
    private summarizer?: Summarizer;

    constructor(
        provider: LLMProvider,
        tools: ToolRegistry,
        config?: Partial<AgentConfig>,
        summarizer?: Summarizer
    ) {
        this.provider = provider;
        this.tools = tools;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.systemPrompt = buildSystemPrompt(tools.listNames());
        this.costTracker = new CostTracker(provider.model);
        this.summarizer = summarizer;
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

            // Record cost
            if (response.usage) {
                const entry = this.costTracker.recordUsage(
                    response.usage.inputTokens,
                    response.usage.outputTokens
                );
                if (this.config.verbose) {
                    console.log(
                        chalk.gray(
                            `  [tokens: ${response.usage.inputTokens} in / ${response.usage.outputTokens} out | call: $${entry.cost.toFixed(4)}]`
                        )
                    );
                }
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

                // Compress old history to save tokens
                await this.compressHistory();

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

    /**
     * Get a short cost summary (for display after each response).
     */
    getCostSummary(): string {
        return this.costTracker.getShortSummary();
    }

    /**
     * Get a detailed cost breakdown (for /cost command).
     */
    getCostDetails(): string {
        return this.costTracker.getDetailedSummary();
    }

    /**
     * Reset cost tracking.
     */
    resetCost(): void {
        this.costTracker.reset();
    }

    /**
     * Compress old conversation history to save tokens.
     * Uses LLM summarization if a Summarizer is available;
     * falls back to simple truncation otherwise.
     */
    private async compressHistory(): Promise<void> {
        // Find all tool-result message indices
        const toolMsgIndices: number[] = [];
        for (let i = 0; i < this.conversationHistory.length; i++) {
            if (this.conversationHistory[i].role === "tool") {
                toolMsgIndices.push(i);
            }
        }

        // Only compress if we exceed the window
        const excess = toolMsgIndices.length - this.config.historyWindowSize;
        if (excess <= 0) return;

        // Determine the range of messages to compress:
        // from the start up to (and including) the last excess tool message
        const lastExcessToolIdx = toolMsgIndices[excess - 1];
        // Include one message after the last tool result (the next assistant/user)
        const cutoffIdx = Math.min(lastExcessToolIdx + 1, this.conversationHistory.length);
        const oldMessages = this.conversationHistory.slice(0, cutoffIdx);

        if (this.summarizer) {
            try {
                const summary = await this.summarizer.summarize(oldMessages);

                if (this.config.verbose) {
                    console.log(
                        chalk.gray(`  [compressed ${oldMessages.length} old messages into summary]`)
                    );
                }

                // Replace old messages with a single context message
                this.conversationHistory = [
                    {
                        role: "user",
                        content: `[Context from earlier in this conversation: ${summary}]`,
                    },
                    ...this.conversationHistory.slice(cutoffIdx),
                ];
                return;
            } catch {
                // Fall through to truncation if summarization fails
                if (this.config.verbose) {
                    console.log(
                        chalk.yellow(`  [summarization failed, falling back to truncation]`)
                    );
                }
            }
        }

        // Fallback: simple truncation of old tool results
        const MAX_TRUNCATED_LENGTH = 200;
        for (let j = 0; j < excess; j++) {
            const idx = toolMsgIndices[j];
            const msg = this.conversationHistory[idx];
            if (msg.toolResults) {
                msg.toolResults = msg.toolResults.map((tr) => ({
                    ...tr,
                    result:
                        tr.result.length > MAX_TRUNCATED_LENGTH
                            ? tr.result.slice(0, MAX_TRUNCATED_LENGTH) + "... (truncated to save tokens)"
                            : tr.result,
                }));
            }
        }
    }
}
