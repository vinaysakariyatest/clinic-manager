import { GoogleGenerativeAI } from "@google/generative-ai";

export async function speechToText(url: string) {
  try {
    const apiKey = process.env.AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI API Key (Gemini) is not defined in environment variables (AI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY)");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    // Download audio
    const audioResponse = await fetch(url);
    if (!audioResponse.ok) throw new Error("Failed to fetch audio from URL");
    const arrayBuffer = await audioResponse.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    // Transcribe using Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/ogg", // or audio/mpeg based on 11za payload, usually ogg/opus for WA
          data: base64Audio,
        },
      },
      { text: "Transcribe this audio exactly. Just give me the text, no extra comments." },
    ]);

    const transcription = result.response.text();
    return { text: transcription.trim() };
  } catch (error) {
    console.error("Gemini STT Error:", error);
    return { text: "" };
  }
}
