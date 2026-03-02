import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ParsedReceipt } from "@/types/receipt";

const PROMPT = `You are a receipt parser. Extract all data from this receipt image.
Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "lineItems": [{ "name": string, "quantity": number, "unitPrice": number, "totalPrice": number }],
  "subtotal": number | null,
  "tax": number | null,
  "gratuity": number | null,
  "total": number | null,
  "currency": "USD",
  "notes": string | null
}`;

export async function parseReceiptImage(imageUrl: string): Promise<ParsedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  // Fetch image from Supabase Storage and convert to base64
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString("base64");
  const mimeType = (imgRes.headers.get("content-type") ?? "image/jpeg") as
    "image/jpeg" | "image/png" | "image/webp";

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    PROMPT,
  ]);

  const text = result.response.text()
    .replace(/^```json?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Gemini did not return valid JSON");

  return JSON.parse(match[0]) as ParsedReceipt;
}
