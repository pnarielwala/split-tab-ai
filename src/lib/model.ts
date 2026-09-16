import { GoogleGenAI } from '@google/genai';
import type { ParsedReceipt } from '@/types/receipt';

/**
 * Every flash-lite model tested misreads receipts whose amount column is
 * printed offset by a line — 2.5, 3.1 and 3.5 lite all failed the Local Cantina
 * check, with or without a thinking budget. Every full flash model got it
 * right. Verify a replacement with `bun parse:receipt` before changing this.
 */
export const DEFAULT_MODEL = 'gemini-3.8-flash';

/** -1 is dynamic (the model decides), 0 disables thinking. */
const THINKING_BUDGET = Number(process.env.GEMINI_THINKING_BUDGET ?? 0);

/**
 * Shape the response is constrained to. The model cannot return prose, a
 * markdown fence, or a missing field, so the response is parseable without
 * the string surgery this module used to do. Keep in sync with ParsedReceipt.
 *
 * Gemini supports only a subset of JSON Schema for responseJsonSchema, so
 * nullable fields use `anyOf` — which is on the supported list — rather than
 * the array-valued `type` form, which is not.
 */
const nullable = (type: string) => ({ anyOf: [{ type }, { type: 'null' }] });

export const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    restaurantName: nullable('string'),
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          totalPrice: { type: 'number' },
        },
        required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
      },
    },
    subtotal: nullable('number'),
    tax: nullable('number'),
    gratuity: nullable('number'),
    fees: nullable('number'),
    discounts: nullable('number'),
    total: nullable('number'),
    currency: { type: 'string' },
    notes: nullable('string'),
  },
  required: [
    'restaurantName',
    'lineItems',
    'subtotal',
    'tax',
    'gratuity',
    'fees',
    'discounts',
    'total',
    'currency',
    'notes',
  ],
};

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

CRITICAL — matching amounts to names. This is where receipt parsing goes wrong most often, so work through it deliberately.

Thermal printers frequently print the amount column offset by a full text line from the item names, and photographs are skewed or curled on top of that. The amount that LOOKS vertically aligned with a name is often the amount belonging to a neighbouring row. Never pair by vertical position. Use this procedure instead:
1. Read the item NAMES top to bottom as one ordered list. This list is authoritative: there are exactly as many line items as there are printed names — never more, never fewer.
2. Read the AMOUNTS in the item block top to bottom as a second ordered list.
3. Pair strictly by position. The 1st name takes the 1st amount, the 2nd name the 2nd amount, and so on to the end. Ignore how the two columns appear to line up on the page.
4. NEVER invent, duplicate or split a line item in order to absorb a leftover amount, and never drop an amount to make things fit. If an amount seems left over, your pairing is wrong — not the receipt. Return to step 3 and re-pair from the top.

Signs the amount column is printed offset by one line. Expect these; they are common, and none of them mean an item is missing:
- the topmost amount sits ABOVE the first item name
- the last item name sits BELOW the bottom-most amount
- pairing by vertical position leaves the final name with no amount
- pairing by vertical position produces an implausible price: a side dish or a bag of chips priced like a pitcher, a pitcher or premium bottle priced like a single side, or two identical item names carrying wildly different prices
In every one of these cases the two lists are still the SAME length. Pair the 1st name with the 1st amount exactly as in step 3. Do not add a row, do not remove a row, do not shift the names.

Use plausibility as a final confirmation: a pitcher, bottle or premium spirit costs more than a single house drink; a "Side" costs less than an entree; identical item names normally carry identical prices unless a size or premium modifier is printed.

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
1. Does lineItems have exactly one entry per printed item NAME? Recount the names on the image. One too few almost always means you dropped a repeated adjacent row — find it. One too many means you invented a row to absorb a leftover amount — remove it and re-pair the amounts by position from the top.
2. Does the sum of every lineItems totalPrice equal subtotal exactly? If it is short by roughly one item's price you dropped a row. If individual prices look implausible or one item ended up unpriced, the amount column is offset by one — re-pair and recompute.
3. Does subtotal + tax + gratuity + fees - discounts equal total?
Never invent, drop, merge or adjust a line item or a price to force these to reconcile. Re-read the image instead. If it still does not reconcile after re-reading, report the literal printed values and describe the discrepancy in "notes".

For "restaurantName": extract the business or restaurant name from the receipt header. Return null if not identifiable.`;

/**
 * Parse an already-loaded receipt image. Separate from parseReceiptImage so the
 * same code path can be driven from a local file — see scripts/parse-receipt.ts,
 * which is how prompt and model changes get checked against real receipts.
 */
export async function parseReceiptBytes(
  base64: string,
  mimeType: string
): Promise<ParsedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey)
    throw new Error('GEMINI_API_KEY environment variable is not set');

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: [{ inlineData: { mimeType, data: base64 } }, PROMPT],
    config: {
      // Extraction should be reproducible: the same receipt is the same answer.
      temperature: 0,
      // The prompt's verification pass (count the names, pair the two columns
      // by position, check the sum) needs a reasoning budget to run in.
      thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      responseMimeType: 'application/json',
      responseJsonSchema: RECEIPT_SCHEMA,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    // Empty candidate — a safety block or a truncated response, not bad JSON.
    const reason = response.candidates?.[0]?.finishReason;
    throw new Error(
      `Gemini returned no content${reason ? ` (finishReason: ${reason})` : ''}`
    );
  }

  try {
    return JSON.parse(text) as ParsedReceipt;
  } catch {
    // The schema should make this unreachable. Fall back to the old salvage
    // path rather than failing the whole parse on an unexpected wrapper.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini did not return valid JSON');
    return JSON.parse(match[0]) as ParsedReceipt;
  }
}

export async function parseReceiptImage(
  imageUrl: string
): Promise<ParsedReceipt> {
  // Fetch image from Supabase Storage and convert to base64
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  const mimeType = imgRes.headers.get('content-type') ?? 'image/jpeg';

  return parseReceiptBytes(base64, mimeType);
}
