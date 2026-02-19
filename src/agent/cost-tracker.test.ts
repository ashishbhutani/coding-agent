/**
 * Tests for CostTracker
 */

import { describe, it, expect } from "vitest";
import { CostTracker, MODEL_PRICING } from "./cost-tracker.js";

describe("CostTracker", () => {
    it("should accumulate tokens across calls", () => {
        const tracker = new CostTracker("gemini-2.5-pro");

        tracker.recordUsage(1000, 200);
        tracker.recordUsage(500, 100);

        expect(tracker.getTotalInputTokens()).toBe(1500);
        expect(tracker.getTotalOutputTokens()).toBe(300);
        expect(tracker.getEntryCount()).toBe(2);
    });

    it("should calculate cost correctly for gemini-2.5-pro", () => {
        const tracker = new CostTracker("gemini-2.5-pro");

        // 100k input at $1.25/M + 10k output at $10/M
        // = 0.125 + 0.10 = 0.225
        tracker.recordUsage(100_000, 10_000);

        expect(tracker.getTotalCost()).toBeCloseTo(0.225, 3);
    });

    it("should use long-context pricing when threshold exceeded", () => {
        const tracker = new CostTracker("gemini-2.5-pro");

        // First call: 150k tokens (under threshold)
        const entry1 = tracker.recordUsage(150_000, 1000);
        // $1.25/M rate
        expect(entry1.cost).toBeCloseTo(
            (150_000 / 1_000_000) * 1.25 + (1000 / 1_000_000) * 10,
            4
        );

        // Second call: 100k tokens (cumulative 250k, over 200k threshold)
        const entry2 = tracker.recordUsage(100_000, 1000);
        // $2.50/M rate for input, $15/M for output
        expect(entry2.cost).toBeCloseTo(
            (100_000 / 1_000_000) * 2.5 + (1000 / 1_000_000) * 15,
            4
        );
    });

    it("should format short summary with commas", () => {
        const tracker = new CostTracker("gemini-2.5-pro");
        tracker.recordUsage(12000, 340);

        const summary = tracker.getShortSummary();
        expect(summary).toContain("12,340");
        expect(summary).toContain("$");
    });

    it("should produce detailed summary", () => {
        const tracker = new CostTracker("gemini-2.5-pro");
        tracker.recordUsage(5000, 500);
        tracker.recordUsage(3000, 300);

        const details = tracker.getDetailedSummary();
        expect(details).toContain("Session Cost Summary");
        expect(details).toContain("Calls:");
        expect(details).toContain("2");
        expect(details).toContain("Input tokens:");
        expect(details).toContain("Output tokens:");
        expect(details).toContain("Total cost:");
    });

    it("should reset all tracking data", () => {
        const tracker = new CostTracker("gemini-2.5-pro");
        tracker.recordUsage(5000, 500);
        tracker.reset();

        expect(tracker.getTotalInputTokens()).toBe(0);
        expect(tracker.getTotalOutputTokens()).toBe(0);
        expect(tracker.getTotalCost()).toBe(0);
        expect(tracker.getEntryCount()).toBe(0);
    });

    it("should fall back to gemini-2.5-pro pricing for unknown models", () => {
        const tracker = new CostTracker("unknown-model-xyz");
        tracker.recordUsage(100_000, 0);

        // Should use gemini-2.5-pro input rate: $1.25/M → 100k = $0.125
        expect(tracker.getTotalCost()).toBeCloseTo(0.125, 3);
    });

    it("should have pricing for gemini-2.5-flash", () => {
        expect(MODEL_PRICING["gemini-2.5-flash"]).toBeDefined();

        const tracker = new CostTracker("gemini-2.5-flash");
        // 100k input at $0.15/M + 50k output at $0.60/M
        // = 0.015 + 0.030 = 0.045
        tracker.recordUsage(100_000, 50_000);

        expect(tracker.getTotalCost()).toBeCloseTo(0.045, 3);
    });
});
