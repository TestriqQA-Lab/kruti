import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// Separate client for the newer unified SDK, used for Google Search grounding.
let _groundedAI: GoogleGenAI | null = null;
function getGroundedClient(): GoogleGenAI {
  if (!_groundedAI) {
    _groundedAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _groundedAI;
}

export function getGeminiModel(modelName = "gemini-2.5-flash") {
  return genAI.getGenerativeModel({ model: modelName });
}

export async function generateText(prompt: string): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function generateTextWithConfig(
  prompt: string,
  config: { temperature?: number } = {}
): Promise<string> {
  const model = getGeminiModel();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: config.temperature ?? 1.0 },
  });
  return result.response.text();
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

/**
 * Generate text grounded in live Google Search results (Gemini grounding tool).
 * Used for the research step before writing posts so content is based on real,
 * current information. Returns FREE-FORM text (not JSON) - do NOT pass it to
 * parseJSON. Callers should wrap this in try/catch and degrade gracefully.
 */
export async function generateGroundedText(prompt: string): Promise<string> {
  const ai = getGroundedClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });
  return response.text ?? "";
}
