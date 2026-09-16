/**
 * Run the real receipt parser against a local image and show whether the result
 * reconciles. Prompt and model changes are hard to judge without this — the app
 * path needs Supabase, an upload and a bill.
 *
 *   bun --env-file=.env.local scripts/parse-receipt.ts path/to/receipt.jpg
 *
 * Compare two models on the same receipt:
 *
 *   GEMINI_MODEL=gemini-3.5-flash-lite bun --env-file=.env.local \
 *     scripts/parse-receipt.ts path/to/receipt.jpg
 *
 * Pass --expect <subtotal> to check against the subtotal you read off the paper
 * yourself, rather than trusting the model's own reading of it.
 */
import { readFileSync } from 'fs';
import { extname } from 'path';
import { parseReceiptBytes, DEFAULT_MODEL } from '../src/lib/model';
import { reconcileSubtotal, sumLineItems, describeReconciliation } from '../src/lib/reconcile';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

const args = process.argv.slice(2);
const expectIdx = args.indexOf('--expect');
const expected = expectIdx === -1 ? null : Number(args[expectIdx + 1]);
const path = args.filter(
  (_, i) => expectIdx === -1 || (i !== expectIdx && i !== expectIdx + 1)
)[0];

if (!path) {
  console.error('Usage: bun --env-file=.env.local scripts/parse-receipt.ts <image> [--expect <subtotal>]');
  process.exit(1);
}

const mimeType = MIME[extname(path).toLowerCase()];
if (!mimeType) {
  console.error(`Unsupported image type: ${extname(path) || path}`);
  process.exit(1);
}

const money = (n: number | null | undefined) =>
  n == null ? '—' : `$${n.toFixed(2)}`;

const started = Date.now();
let parsed;
try {
  parsed = await parseReceiptBytes(readFileSync(path).toString('base64'), mimeType);
} catch (err) {
  console.error(`\nParse failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

console.log(`\n${parsed.restaurantName ?? '(no restaurant name)'}`);
console.log(`${process.env.GEMINI_MODEL || DEFAULT_MODEL} · ${elapsed}s\n`);

for (const [i, item] of parsed.lineItems.entries()) {
  const qty = item.quantity !== 1 ? `${item.quantity} × ${money(item.unitPrice)}` : '';
  console.log(
    `${String(i + 1).padStart(3)}. ${item.name.padEnd(32)} ${money(item.totalPrice).padStart(9)}  ${qty}`
  );
}

const itemsSum = sumLineItems(
  parsed.lineItems.map((i) => ({ total_price: i.totalPrice }))
);

console.log('');
console.log(`     ${'items'.padEnd(32)} ${String(parsed.lineItems.length).padStart(9)}`);
console.log(`     ${'sum of items'.padEnd(32)} ${money(itemsSum).padStart(9)}`);
for (const [label, value] of [
  ['subtotal (read off receipt)', parsed.subtotal],
  ['tax', parsed.tax],
  ['gratuity', parsed.gratuity],
  ['fees', parsed.fees],
  ['discounts', parsed.discounts],
  ['total', parsed.total],
] as const) {
  if (value != null) console.log(`     ${label.padEnd(32)} ${money(value).padStart(9)}`);
}
if (parsed.notes) console.log(`\n     notes: ${parsed.notes}`);

// Check against the model's own reading, and against yours if you supplied one.
let failed = false;
for (const [source, subtotal] of [
  ["model's subtotal", parsed.subtotal],
  ...(expected != null ? ([['--expect', expected]] as const) : []),
] as const) {
  const r = reconcileSubtotal(itemsSum, subtotal);
  const message = describeReconciliation(r, money);
  if (r.status === 'mismatch') failed = true;
  console.log(
    `\n${r.status === 'ok' ? '✓' : r.status === 'unavailable' ? '–' : '✗'} vs ${source}: ${
      message ?? (r.status === 'ok' ? 'items reconcile' : 'no subtotal to check against')
    }`
  );
}

process.exit(failed ? 1 : 0);
