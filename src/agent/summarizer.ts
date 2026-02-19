/**
 * Conversation Summarizer
 *
 * Uses a cheap LLM (gemini-2.0-flash) to compress old conversation
 * history into a compact summary, saving tokens on the main model.
 */

import type { LLMProvider, LLMMessage } from "../llm/provider.js";
import { GeminiProvider } from "../llm/gemini.js";

const SUMMARIZE_PROMPT = `You are a concise summarizer. Summarize the following agent-user interaction in 2-3 sentences.
Focus on: what the user asked for, what actions the agent took (tools used, files modified), and the outcomes.
Do NOT include code snippets. Be factual and brief.`;

export class Summarizer {
    private provider: LLMProvider;

    constructor(apiKey: string) {
        this.provider = new GeminiProvider({
            apiKey,
            model: "gemini-2.0-flash",
            maxTokens: 256,
            temperature: 0.1,
        });
    }

    /**
     * Summarize a list of conversation messages into a compact string.
     */
    async summarize(messages: LLMMessage[]): Promise<string> {
        // Build a plain-text representation of the messages
        const text = messages
            .map((msg) => {
                if (msg.role === "user") {
                    return `User: ${msg.content}`;
                }
                if (msg.role === "assistant") {
                    let line = `Agent: ${msg.content}`;
                    if (msg.toolCalls?.length) {
                        const calls = msg.toolCalls
                            .map((tc) => `${tc.name}(${JSON.stringify(tc.arguments)})`)
                            .join(", ");
                        line += ` [called: ${calls}]`;
                    }
                    return line;
                }
                if (msg.role === "tool" && msg.toolResults?.length) {
                    return msg.toolResults
                        .map((tr) => {
                            const preview = tr.result.length > 200
                                ? tr.result.slice(0, 200) + "..."
                                : tr.result;
                            return `Tool ${tr.name}: ${preview}`;
                        })
                        .join("\n");
                }
                return "";
            })
            .filter(Boolean)
            .join("\n");

        const response = await this.provider.chat(
            [{ role: "user", content: text }],
            [],  // no tools
            SUMMARIZE_PROMPT
        );

        return response.content.trim();
    }
}
