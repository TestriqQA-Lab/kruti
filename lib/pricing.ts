// ─── lib/pricing.ts ───────────────────────────────────────────────────────────
// Single source of truth for Gemini API cost ESTIMATION, in USD, converted to INR.
//
// The app does not store token usage or billed amounts anywhere, so every figure
// here is an ESTIMATE: (activity counts) x (published Gemini unit pricing). Real
// billing lives in the Google Cloud / Gemini billing console. Pricing verified
// against https://ai.google.dev/gemini-api/docs/pricing (June 2026). Token rule of
// thumb: ~4 characters per token.
//
// Models in use:
//   - Images: Nano Banana Pro = gemini-3-pro-image (priced by image output tokens).
//   - Text:   gemini-2.5-flash (posts, strategy, image briefs) + Google Search grounding.

/** USD -> INR. Override via env (e.g. for live FX) without code changes. */
export const USD_TO_INR = Number(process.env.USD_TO_INR ?? 85);

// ── Gemini 2.5 Flash (all text) — USD per 1M tokens ──
export const FLASH_INPUT_USD_PER_M = 0.3;
export const FLASH_OUTPUT_USD_PER_M = 2.5;

// ── Google Search grounding tool (gemini-2.5-flash tier) — USD per grounded prompt ──
export const GROUNDING_USD_PER_CALL = 35 / 1000; // $35 / 1,000 prompts = 0.035

// ── Nano Banana Pro = gemini-3-pro-image — image OUTPUT tokens ──
export const IMAGE_OUTPUT_USD_PER_M = 120; // $120 / 1M image-output tokens
export const IMAGE_TOKENS_2K = 1120; // 1K and 2K both bill 1120 output tokens
export const IMAGE_TOKENS_4K = 2000;

export const toInr = (usd: number): number => usd * USD_TO_INR;

export function flashTextCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * FLASH_INPUT_USD_PER_M + (outputTokens / 1e6) * FLASH_OUTPUT_USD_PER_M;
}

/** Cost (USD) of generating one image at the given resolution (output tokens only). */
export function imageCostUsd(resolution: "1K" | "2K" | "4K" = "2K"): number {
  const tokens = resolution === "4K" ? IMAGE_TOKENS_4K : IMAGE_TOKENS_2K;
  return (tokens / 1e6) * IMAGE_OUTPUT_USD_PER_M;
}

/** One grounded research call: flash text + N grounding queries. */
export function groundedCallCostUsd(inputTokens: number, outputTokens: number, groundingQueries = 1): number {
  return flashTextCostUsd(inputTokens, outputTokens) + groundingQueries * GROUNDING_USD_PER_CALL;
}

// ── Workload token estimates (tuned to lib/prompts.ts) ──
const EST = {
  research: { input: 3000, output: 500 }, // buildResearchPrompt (grounded)
  postsWrite: { input: 3500, perPostOutput: 460 }, // buildPostsPrompt
  strategy: { input: 3000, output: 1200 }, // buildStrategyPrompt
  imageBrief: { input: 1500, output: 250 }, // image / carousel-plan brief
} as const;

/** Full /api/generate/posts batch: grounded research + writing N posts (USD). */
export function postsBatchCostUsd(postCount = 5): number {
  const research = groundedCallCostUsd(EST.research.input, EST.research.output, 1);
  const write = flashTextCostUsd(EST.postsWrite.input, EST.postsWrite.perPostOutput * postCount);
  return research + write;
}

export function strategyCostUsd(): number {
  return flashTextCostUsd(EST.strategy.input, EST.strategy.output);
}

// ── Per-unit INR rates the analytics dashboard multiplies by activity counts ──

/** Per generated image (Nano Banana Pro @ 2K), incl. its small text brief. */
export const IMAGE_COST_INR = toInr(
  imageCostUsd("2K") + flashTextCostUsd(EST.imageBrief.input, EST.imageBrief.output)
); // ~INR 11.48

/**
 * Per post created. A posts batch (~5 posts) costs one grounded research call plus
 * one writing call; the grounding fee dominates and is fixed per batch, so we
 * amortise the typical 5-post batch across its posts.
 */
export const CONTENT_COST_PER_POST_INR = toInr(postsBatchCostUsd(5) / 5); // ~INR 0.75

/** Per strategy (ContentPlan) generation. */
export const STRATEGY_COST_INR = toInr(strategyCostUsd()); // ~INR 0.33

/** Assumed batch size used when amortising per-post content cost (for transparency). */
export const ASSUMED_POSTS_PER_BATCH = 5;

/** Format a number as Indian Rupees, e.g. 11.39 -> "₹11.39". */
export function formatInr(amount: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}
