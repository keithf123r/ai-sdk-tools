/**
 * Shared Agent Configuration
 *
 * Dynamic context and utilities used across all agents
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openai } from "@ai-sdk/openai";
import type { AgentConfig } from "@ai-sdk-tools/agents";
import { Agent } from "@ai-sdk-tools/agents";
import { UpstashProvider } from "@ai-sdk-tools/memory";
import { Redis } from "@upstash/redis";

// Load memory template from markdown file
const memoryTemplate = readFileSync(
  join(process.cwd(), "src/ai/agents/memory-template.md"),
  "utf-8",
);

// Load suggestions instructions from markdown file
const suggestionsInstructions = readFileSync(
  join(process.cwd(), "src/ai/agents/suggestions-instructions.md"),
  "utf-8",
);

/**
 * Application context passed to agents
 * Built dynamically per-request with current date/time
 */
export interface AppContext {
  userId: string;
  fullName: string;
  companyName: string;
  baseCurrency: string;
  locale: string;
  currentDateTime: string;
  country?: string;
  city?: string;
  region?: string;
  timezone: string;
  chatId: string;
  // Allow additional properties to satisfy Record<string, unknown> constraint
  [key: string]: unknown;
}

/**
 * Build application context dynamically
 * Ensures current date/time on every request
 */
export function buildAppContext(params: {
  userId: string;
  fullName: string;
  companyName: string;
  country?: string;
  city?: string;
  region?: string;
  chatId: string;
  baseCurrency?: string;
  locale?: string;
  timezone?: string;
}): AppContext {
  const now = new Date();
  return {
    userId: params.userId,
    fullName: params.fullName,
    companyName: params.companyName,
    country: params.country,
    city: params.city,
    region: params.region,
    chatId: params.chatId,
    baseCurrency: params.baseCurrency || "USD",
    locale: params.locale || "en-US",
    currentDateTime: now.toISOString(),
    timezone:
      params.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

/**
 * Format context for LLM system prompts
 * Auto-injected by agent instructions functions
 *
 * Note: User-specific info (name, preferences, etc) should be stored in working memory,
 * not hardcoded here. This keeps system context separate from learned user context.
 */
export function formatContextForLLM(context: AppContext): string {
  return `
CURRENT CONTEXT:
- Date: ${context.currentDateTime}
- Timezone: ${context.timezone}
- Company: ${context.companyName}
- Currency: ${context.baseCurrency}
- Locale: ${context.locale}

Important: 
- Use the current date/time above for any time-sensitive operations
- User-specific information (name, role, preferences) is maintained in your working memory
`;
}

/**
 * Memory provider instance - used across all agents
 * Can be accessed for direct queries (e.g., listing chats)
 */
export const memoryProvider = new UpstashProvider(
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  }),
);

export const createAgent = (config: AgentConfig<AppContext>) => {
  return new Agent<AppContext>({
    modelSettings: {
      parallel_tool_calls: true,
    },
    ...config,
    memory: {
      provider: memoryProvider,
      history: {
        enabled: true,
        limit: 10,
      },
      workingMemory: {
        enabled: true,
        template: memoryTemplate,
        scope: "user",
      },
      chats: {
        enabled: true,
        generateTitle: {
          model: openai("gpt-4.1-nano"),
          instructions:
            "Generate a short, focused title based on the user's message. Max 50 characters. Focus on the main action or topic. Return ONLY plain text - no markdown, no quotes, no special formatting. Examples: Hiring Analysis, Affordability Check, Burn Rate Forecast, Price Research, Account Balance, Revenue Report",
        },
        generateSuggestions: {
          enabled: true,
          model: openai("gpt-4.1-nano"),
          limit: 5,
          instructions: suggestionsInstructions,
        },
      },
    },
  });
};
