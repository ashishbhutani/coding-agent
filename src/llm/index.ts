/**
 * LLM Module Exports
 */

export type {
    LLMProvider,
    LLMProviderConfig,
    LLMMessage,
    LLMResponse,
    ToolCall,
    ToolResult,
    ToolDefinition,
} from "./provider.js";

export { GeminiProvider } from "./gemini.js";

import type { LLMProvider, LLMProviderConfig } from "./provider.js";
import { GeminiProvider } from "./gemini.js";

/**
 * Factory function to create an LLM provider based on config.
 */
export function createProvider(
    providerName: string,
    config: LLMProviderConfig
): LLMProvider {
    switch (providerName.toLowerCase()) {
        case "gemini":
            return new GeminiProvider(config);
        // Future providers:
        // case "anthropic":
        //   return new AnthropicProvider(config);
        // case "openai":
        //   return new OpenAIProvider(config);
        // case "ollama":
        //   return new OllamaProvider(config);
        default:
            throw new Error(
                `Unknown LLM provider: ${providerName}. Available: gemini`
            );
    }
}
