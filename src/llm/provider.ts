/**
 * LLM Provider Interface
 *
 * Abstract interface that all LLM providers must implement.
 * This allows swapping between Gemini, Anthropic, OpenAI, Ollama, etc.
 */

export interface ToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResult {
    name: string;
    result: string;
    isError?: boolean;
}

export interface LLMMessage {
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
}

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMResponse {
    content: string;
    toolCalls: ToolCall[];
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    finishReason: "stop" | "tool_calls" | "max_tokens" | "error";
}

export interface LLMProviderConfig {
    apiKey: string;
    model: string;
    maxTokens?: number;
    temperature?: number;
}

export interface LLMProvider {
    readonly name: string;
    readonly model: string;

    /**
     * Send a conversation to the LLM and get a response.
     * The response may contain tool calls that need to be executed.
     */
    chat(
        messages: LLMMessage[],
        tools?: ToolDefinition[],
        systemPrompt?: string
    ): Promise<LLMResponse>;
}
