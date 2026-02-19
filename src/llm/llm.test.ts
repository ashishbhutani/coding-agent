/**
 * Tests for LLM provider factory
 */

import { describe, it, expect } from "vitest";
import { createProvider } from "./index.js";
import { GeminiProvider } from "./gemini.js";

describe("createProvider", () => {
    it("should create a Gemini provider", () => {
        const provider = createProvider("gemini", {
            apiKey: "test-key",
            model: "gemini-2.5-pro",
        });

        expect(provider).toBeInstanceOf(GeminiProvider);
        expect(provider.name).toBe("gemini");
        expect(provider.model).toBe("gemini-2.5-pro");
    });

    it("should be case-insensitive", () => {
        const provider = createProvider("GEMINI", {
            apiKey: "test-key",
            model: "gemini-2.5-pro",
        });

        expect(provider.name).toBe("gemini");
    });

    it("should throw for unknown provider", () => {
        expect(() =>
            createProvider("unknown-provider", {
                apiKey: "key",
                model: "model",
            })
        ).toThrow("Unknown LLM provider");
    });

    it("should use default model if not specified", () => {
        const provider = createProvider("gemini", {
            apiKey: "test-key",
            model: "",
        });

        expect(provider.model).toBe("gemini-2.5-pro");
    });
});
