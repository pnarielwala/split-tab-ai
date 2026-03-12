import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ParsedReceipt } from '@/types/receipt';

const PROMPT = `You are a receipt parser. Extract all data from this receipt image.
Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "restaurantName": string | null,
  "lineItems": [{ "name": string, "quantity": number, "unitPrice": number, "totalPrice": number }],
  "subtotal": number | null,
  "tax": number | null,
  "gratuity": number | null,
  "fees": number | null,
  "discounts": number | null,
  "total": number | null,
  "currency": "USD",
  "notes": string | null
}
For "restaurantName": extract the business or restaurant name from the receipt header. Return null if not identifiable.
Combine multiple fees (service fee, delivery fee, large party fee, service charge, admin fee, etc.) into a single "fees" value. Combine multiple discounts/coupons/promotions into a single "discounts" value (always a positive number representing the amount subtracted). Combine multiple tax lines (e.g. food sales tax, beverage sales tax, state tax, local tax, etc.) into a single "tax" value by summing them all.
If a line item has per-item adjustments listed beneath it (e.g. add topping, add flavoring, add-ons, modifications, or item-level discounts/removals), fold those adjustment costs into that line item's totalPrice rather than listing them as separate line items. The unitPrice should reflect the base price and totalPrice should be the final net amount after all adjustments for that item.
Fees and charges (operations fee, service fee, delivery fee, large party fee, service charge, admin fee, convenience fee, etc.) must ALWAYS be calculated into the "fees" field — NEVER place fees into lineItems — even if they appear visually mixed in with or adjacent to the ordered items on the receipt.`;

export async function parseReceiptImage(
  imageUrl: string
): Promise<ParsedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error('GEMINI_API_KEY environment variable is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  // Fetch image from Supabase Storage and convert to base64
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  const mimeType = (imgRes.headers.get('content-type') ?? 'image/jpeg') as
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp';

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    PROMPT,
  ]);

  const text = result.response
    .text()
    .replace(/^```json?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini did not return valid JSON');

  return JSON.parse(match[0]) as ParsedReceipt;
}
