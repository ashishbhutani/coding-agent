/**
 * Cost Tracker
 *
 * Accumulates token usage across LLM calls and calculates cost.
 * Supports multiple pricing models.
 */

/** Pricing in dollars per million tokens. */
export interface ModelPricing {
    inputPerMillion: number;
    outputPerMillion: number;
    /** Optional: higher pricing tier when context exceeds this threshold. */
    longContextThreshold?: number;
    longContextInputPerMillion?: number;
    longContextOutputPerMillion?: number;
}

/** Known model pricing configs. */
export const MODEL_PRICING: Record<string, ModelPricing> = {
    "gemini-2.5-pro": {
        inputPerMillion: 1.25,
        outputPerMillion: 10.0,
        longContextThreshold: 200_000,
        longContextInputPerMillion: 2.5,
        longContextOutputPerMillion: 15.0,
    },
    "gemini-2.5-flash": {
        inputPerMillion: 0.15,
        outputPerMillion: 0.60,
        longContextThreshold: 200_000,
        longContextInputPerMillion: 0.30,
        longContextOutputPerMillion: 1.20,
    },
    "gemini-2.0-flash": {
        inputPerMillion: 0.10,
        outputPerMillion: 0.40,
    },
};

/** Usage snapshot from one LLM call. */
export interface UsageEntry {
    inputTokens: number;
    outputTokens: number;
    cost: number;
    timestamp: number;
}

export class CostTracker {
    private pricing: ModelPricing;
    private entries: UsageEntry[] = [];
    private totalInputTokens = 0;
    private totalOutputTokens = 0;
    private totalCost = 0;
    private cumulativeInputTokens = 0; // running context size for long-context pricing

    constructor(model: string) {
        this.pricing = MODEL_PRICING[model] || MODEL_PRICING["gemini-2.5-pro"];
    }

    /**
     * Record usage from one LLM call.
     */
    recordUsage(inputTokens: number, outputTokens: number): UsageEntry {
        this.cumulativeInputTokens += inputTokens;

        // Use long-context pricing if we've exceeded the threshold
        let inputRate = this.pricing.inputPerMillion;
        let outputRate = this.pricing.outputPerMillion;

        if (
            this.pricing.longContextThreshold &&
            this.cumulativeInputTokens > this.pricing.longContextThreshold
        ) {
            inputRate = this.pricing.longContextInputPerMillion ?? inputRate;
            outputRate = this.pricing.longContextOutputPerMillion ?? outputRate;
        }

        const cost =
            (inputTokens / 1_000_000) * inputRate +
            (outputTokens / 1_000_000) * outputRate;

        const entry: UsageEntry = {
            inputTokens,
            outputTokens,
            cost,
            timestamp: Date.now(),
        };

        this.entries.push(entry);
        this.totalInputTokens += inputTokens;
        this.totalOutputTokens += outputTokens;
        this.totalCost += cost;

        return entry;
    }

    /**
     * Get a short formatted summary for display after each response.
     */
    getShortSummary(): string {
        const tokens = this.totalInputTokens + this.totalOutputTokens;
        return `${formatTokenCount(tokens)} tokens | $${this.totalCost.toFixed(4)}`;
    }

    /**
     * Get a detailed breakdown for the /cost command.
     */
    getDetailedSummary(): string {
        const lines: string[] = [];
        lines.push("═══ Session Cost Summary ═══");
        lines.push(`  Calls:         ${this.entries.length}`);
        lines.push(`  Input tokens:  ${formatTokenCount(this.totalInputTokens)}`);
        lines.push(`  Output tokens: ${formatTokenCount(this.totalOutputTokens)}`);
        lines.push(`  Total tokens:  ${formatTokenCount(this.totalInputTokens + this.totalOutputTokens)}`);
        lines.push(`  Total cost:    $${this.totalCost.toFixed(4)}`);
        lines.push("");

        if (this.entries.length > 0) {
            lines.push("  Last 5 calls:");
            const recent = this.entries.slice(-5);
            for (const entry of recent) {
                const tokens = entry.inputTokens + entry.outputTokens;
                lines.push(`    ${formatTokenCount(tokens)} tokens | $${entry.cost.toFixed(4)}`);
            }
        }

        return lines.join("\n");
    }

    /**
     * Reset all tracking data.
     */
    reset(): void {
        this.entries = [];
        this.totalInputTokens = 0;
        this.totalOutputTokens = 0;
        this.totalCost = 0;
        this.cumulativeInputTokens = 0;
    }

    /** Getters for testing. */
    getTotalInputTokens(): number { return this.totalInputTokens; }
    getTotalOutputTokens(): number { return this.totalOutputTokens; }
    getTotalCost(): number { return this.totalCost; }
    getEntryCount(): number { return this.entries.length; }
}

/** Format a token count with commas: 12340 → "12,340" */
function formatTokenCount(n: number): string {
    return n.toLocaleString("en-US");
}
