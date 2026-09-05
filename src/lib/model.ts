import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ParsedReceipt } from '@/types/receipt';

const PROMPT = `You are a meticulous receipt parser. Extract all data from this receipt image.
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

=== READING THE ITEM ROWS ===
Before writing anything, count the printed item rows and count the printed prices in the amount column. "lineItems" must contain EXACTLY one object per printed item row, in top-to-bottom order. Never omit a row.

NEVER merge, group, deduplicate or collapse rows. If the same item name is printed on two or more separate rows (e.g. "Side Street Corn" printed twice in a row, or "Mango Marg" printed four times), each printed row is its own line item with its own price. Do NOT combine them into one row with quantity 2 or more, and do NOT assume a repeated line is an OCR duplicate. Repeated adjacent identical names are normal and expected — a table of people frequently orders the same thing.

CRITICAL — matching prices to names. Receipt photos are skewed, curled or shot at an angle, and thermal printers often print the amount column offset by a line, so the price that LOOKS vertically aligned with an item name is frequently the price of a neighbouring row. Do not trust vertical alignment alone. Instead:
- Read the item names top-to-bottom as one ordered list, and the amounts in the item block top-to-bottom as a second ordered list.
- The two lists must be the same length. Pair them by position: the Nth name gets the Nth amount.
- If a name appears to have no price, or an amount appears to have no name, or the two lists differ in length, the amount column is offset by one row. Shift the entire amount column by one row (up or down) and re-pair, then re-check.
- Use plausibility to confirm the pairing: a pitcher, bottle or premium spirit costs more than a single house drink; a "Side" costs less than an entree; identical item names should normally carry identical prices unless a size or premium modifier is printed. A pairing that makes a side dish cost more than a pitcher is a symptom of a one-row offset, not a real price.

Quantity rules:
- A number that is part of the dish name is NOT a quantity. "Pick 2 Tacos", "Pick 3 Tacos", "3 Amigos Platter", "6oz Sirloin" are all quantity 1 with the number kept in "name".
- A leading count printed as a separate quantity (e.g. "2 Beer", "6 Chips") IS the quantity.
- A price in parentheses or after an "@" is the per-unit price, not the line total. "6 Chips (1.00)" with 6.00 in the amount column means quantity 6, unitPrice 1.00, totalPrice 6.00.
- Otherwise quantity is 1, unitPrice equals totalPrice, and unitPrice = totalPrice / quantity when a quantity is printed.

=== READING THE TOTALS BLOCK ===
The same one-row offset affects the totals block, so verify the labels against arithmetic rather than against vertical alignment:
- subtotal must equal the sum of all lineItems totalPrice.
- subtotal + tax + gratuity + fees - discounts must equal total.
- subtotal must be the largest value in the block after total, and total must be greater than or equal to subtotal. If "Subtotal" appears to be a small number like a tax amount, the amount column is offset by one row — shift it and re-read the whole block.
Combine multiple tax lines (food sales tax, beverage sales tax, state tax, local tax, etc.) into a single "tax" value by summing them all.
Combine multiple fees (service fee, delivery fee, large party fee, service charge, admin fee, convenience fee, operations fee, credit card surcharge, "CC Adjustment", non-cash adjustment, etc.) into a single "fees" value. Fees must ALWAYS go into "fees" — NEVER into lineItems — even when they appear visually mixed in with the ordered items.
Combine multiple discounts/coupons/promotions into a single "discounts" value, always a positive number representing the amount subtracted.

=== LINES THAT ARE NOT ITEMS AND NOT TOTALS ===
Ignore these entirely — they are neither lineItems nor any total field:
- split suggestions, e.g. "If split among 11 guests each pay $30.70"
- alternate pricing lines, e.g. "CASH PRICE: $328.49", "cash discount price", "you saved". Always use the printed TOTAL / BALANCE DUE / AMOUNT DUE for "total", not the cash price.
- header/footer metadata: check number, table number, guest count, server name, date, time, address, phone, tip suggestion lines, loyalty points, survey text, QR codes.

=== PER-ITEM MODIFIERS ===
If a line item has per-item adjustments listed beneath it (add topping, add flavoring, add-ons, modifications, or item-level discounts/removals), fold those adjustment costs into that line item's totalPrice rather than listing them as separate line items. unitPrice should reflect the base price and totalPrice should be the final net amount after all adjustments for that item.

=== VERIFY BEFORE YOU ANSWER ===
Do this check and fix any problem before emitting JSON:
1. Does lineItems have one entry per printed item row? Recount the rows on the image. A count that is one short almost always means you dropped a repeated adjacent row — find it.
2. Does the sum of every lineItems totalPrice equal subtotal exactly? If it is short by roughly one item's price you dropped a row. If individual prices look implausible or one item ended up unpriced, the amount column is offset by one — re-pair and recompute.
3. Does subtotal + tax + gratuity + fees - discounts equal total?
Never invent, drop, merge or adjust a line item or a price to force these to reconcile. Re-read the image instead. If it still does not reconcile after re-reading, report the literal printed values and describe the discrepancy in "notes".

For "restaurantName": extract the business or restaurant name from the receipt header. Return null if not identifiable.`;

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
