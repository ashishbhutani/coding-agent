/**
 * Gemini LLM Provider
 *
 * Implements the LLM provider interface using Google's Generative AI SDK.
 */

import {
    GoogleGenerativeAI,
    FunctionCallingMode,
    SchemaType,
} from "@google/generative-ai";
import type {
    LLMProvider,
    LLMProviderConfig,
    LLMMessage,
    LLMResponse,
    ToolDefinition,
    ToolCall,
} from "./provider.js";

export class GeminiProvider implements LLMProvider {
    readonly name = "gemini";
    readonly model: string;

    private client: GoogleGenerativeAI;
    private maxTokens: number;
    private temperature: number;

    constructor(config: LLMProviderConfig) {
        this.model = config.model || "gemini-2.5-pro";
        this.maxTokens = config.maxTokens || 8192;
        this.temperature = config.temperature || 0.2;
        this.client = new GoogleGenerativeAI(config.apiKey);
    }

    async chat(
        messages: LLMMessage[],
        tools?: ToolDefinition[],
        systemPrompt?: string
    ): Promise<LLMResponse> {
        // Build the generative model with config
        const modelConfig: Record<string, unknown> = {
            model: this.model,
            generationConfig: {
                maxOutputTokens: this.maxTokens,
                temperature: this.temperature,
            },
        };

        if (systemPrompt) {
            modelConfig.systemInstruction = systemPrompt;
        }

        // Convert our tool definitions to Gemini format
        if (tools?.length) {
            modelConfig.tools = [
                {
                    functionDeclarations: tools.map((t) => ({
                        name: t.name,
                        description: t.description,
                        parameters: this.convertJsonSchemaToGemini(t.parameters),
                    })),
                },
            ];
            modelConfig.toolConfig = {
                functionCallingConfig: {
                    mode: FunctionCallingMode.AUTO,
                },
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const generativeModel = this.client.getGenerativeModel(modelConfig as any);

        // Convert our messages to Gemini format
        const contents = this.convertMessages(messages);

        // Debug: dump full prompt payload when DEBUG_PROMPTS=1
        if (process.env.DEBUG_PROMPTS === "1") {
            console.log("\n" + "═".repeat(80));
            console.log("🔍 DEBUG: PROMPT SENT TO MODEL");
            console.log("═".repeat(80));

            if (systemPrompt) {
                console.log("\n── System Prompt ──");
                console.log(systemPrompt);
            }

            console.log("\n── Messages ──");
            for (const c of contents) {
                console.log(`\n[${c.role}]`);
                for (const part of c.parts) {
                    if ('text' in part) {
                        console.log(part.text);
                    } else if ('functionCall' in part) {
                        const fc = part.functionCall as { name: string; args: unknown };
                        console.log(`  → call: ${fc.name}(${JSON.stringify(fc.args)})`);
                    } else if ('functionResponse' in part) {
                        const fr = part.functionResponse as { name: string; response: unknown };
                        console.log(`  ← result: ${fr.name} → ${JSON.stringify(fr.response)}`);
                    }
                }
            }

            if (tools?.length) {
                console.log("\n── Tool Definitions ──");
                for (const t of tools) {
                    console.log(`  • ${t.name}: ${t.description?.slice(0, 100)}`);
                }
            }

            console.log("\n" + "═".repeat(80) + "\n");
        }

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = await generativeModel.generateContent({ contents } as any);

            const response = result.response;

            // Parse response
            const toolCalls: ToolCall[] = [];
            let textContent = "";

            const candidate = response.candidates?.[0];
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        textContent += part.text;
                    }
                    if (part.functionCall) {
                        toolCalls.push({
                            name: part.functionCall.name,
                            arguments: (part.functionCall.args as Record<string, unknown>) || {},
                        });
                    }
                }
            }

            const hasToolCalls = toolCalls.length > 0;

            return {
                content: textContent,
                toolCalls,
                usage: response.usageMetadata
                    ? {
                        inputTokens: response.usageMetadata.promptTokenCount || 0,
                        outputTokens: response.usageMetadata.candidatesTokenCount || 0,
                    }
                    : undefined,
                finishReason: hasToolCalls ? "tool_calls" : "stop",
            };
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error);
            throw new Error(`Gemini API error: ${message}`);
        }
    }

    /**
     * Convert our message format to Gemini's content format.
     */
    private convertMessages(
        messages: LLMMessage[]
    ): Array<{ role: string; parts: Array<Record<string, unknown>> }> {
        const contents: Array<{
            role: string;
            parts: Array<Record<string, unknown>>;
        }> = [];

        for (const msg of messages) {
            if (msg.role === "system") {
                // System messages are handled via systemInstruction
                continue;
            }

            if (msg.role === "user") {
                contents.push({
                    role: "user",
                    parts: [{ text: msg.content }],
                });
            } else if (msg.role === "assistant") {
                const parts: Array<Record<string, unknown>> = [];
                if (msg.content) {
                    parts.push({ text: msg.content });
                }
                if (msg.toolCalls) {
                    for (const tc of msg.toolCalls) {
                        parts.push({
                            functionCall: {
                                name: tc.name,
                                args: tc.arguments,
                            },
                        });
                    }
                }
                if (parts.length > 0) {
                    contents.push({ role: "model", parts });
                }
            } else if (msg.role === "tool") {
                // Tool results go as user role with functionResponse parts
                if (msg.toolResults) {
                    const parts = msg.toolResults.map((tr) => ({
                        functionResponse: {
                            name: tr.name,
                            response: { result: tr.result },
                        },
                    }));
                    contents.push({ role: "user", parts });
                }
            }
        }

        return contents;
    }

    /**
     * Convert JSON Schema to Gemini's schema format.
     */
    private convertJsonSchemaToGemini(
        schema: Record<string, unknown>
    ): Record<string, unknown> {
        if (!schema || typeof schema !== "object") {
            return { type: SchemaType.OBJECT, properties: {} };
        }

        const result: Record<string, unknown> = {};

        if (schema.type) {
            const typeMap: Record<string, SchemaType> = {
                string: SchemaType.STRING,
                number: SchemaType.NUMBER,
                integer: SchemaType.INTEGER,
                boolean: SchemaType.BOOLEAN,
                array: SchemaType.ARRAY,
                object: SchemaType.OBJECT,
            };
            result.type = typeMap[schema.type as string] || SchemaType.STRING;
        }

        if (schema.description) {
            result.description = schema.description;
        }

        if (schema.properties) {
            const properties: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(
                schema.properties as Record<string, unknown>
            )) {
                properties[key] = this.convertJsonSchemaToGemini(
                    value as Record<string, unknown>
                );
            }
            result.properties = properties;
        }

        if (schema.required) {
            result.required = schema.required;
        }

        if (schema.items) {
            result.items = this.convertJsonSchemaToGemini(
                schema.items as Record<string, unknown>
            );
        }

        if (schema.enum) {
            result.enum = schema.enum;
        }

        return result;
    }
}
