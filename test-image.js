const { GoogleGenAI } = require("@google/genai");

async function test() {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: "A professional business meeting",
      config: { responseModalities: ["IMAGE"] },
    });
    console.log(JSON.stringify(response.candidates[0].content.parts, null, 2));
  } catch (err) {
    console.error(err);
  }
}

test();
