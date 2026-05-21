import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export function getGeminiModel(modelName = "gemini-2.5-flash") {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Returns true if the error is a transient/retryable one
 * (502 Bad Gateway, 503 overloaded, 429 rate-limit, network blips).
 * These usually succeed on a retry — they are NOT code bugs.
 */
function isRetryableError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  const status = e?.status;
  if (status === 502 || status === 503 || status === 429 || status === 500) {
    return true;
  }
  const msg = (e?.message || "").toLowerCase();
  return (
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("bad gateway") ||
    msg.includes("overloaded") ||
    msg.includes("unavailable") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("fetch failed") ||
    msg.includes("network")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a Gemini call with automatic retry on transient errors.
 * Tries up to `maxAttempts` times with exponential backoff
 * (1.5s, 3s, 6s). Non-retryable errors are thrown immediately.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 4,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableError(err) || attempt === maxAttempts) {
        throw err;
      }
      const delay = 1500 * Math.pow(2, attempt - 1); // 1.5s, 3s, 6s
      console.warn(
        `[gemini] ${label} attempt ${attempt}/${maxAttempts} failed ` +
          `(retryable) — retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  throw lastErr;
}

export async function generateText(prompt: string): Promise<string> {
  return withRetry(async () => {
    const model = getGeminiModel();
    const result = await model.generateContent(prompt);
    return result.response.text();
  }, "generateText");
}

export async function generateTextWithConfig(
  prompt: string,
  config: { temperature?: number } = {},
): Promise<string> {
  return withRetry(async () => {
    const model = getGeminiModel();
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: config.temperature ?? 1.0 },
    });
    return result.response.text();
  }, "generateTextWithConfig");
}

export function parseJSON<T>(text: string): T {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\n?/, "")
    .replace(/^```\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}