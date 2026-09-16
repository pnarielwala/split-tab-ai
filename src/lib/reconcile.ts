/**
 * Receipt reconciliation.
 *
 * A parsed receipt gives us two independent readings of the same number: the
 * subtotal printed on the receipt, and the sum of the line items extracted from
 * it. On a correct parse they agree. When they disagree the parse is wrong —
 * and we know that without knowing which of the two readings is the bad one.
 *
 * That covers the whole class of parser failures that matter here: a dropped
 * row, a price column read off by one, a misread digit, a hallucinated item.
 * All of them break the arithmetic.
 *
 * We never auto-correct. Since we can't tell which reading is wrong, silently
 * reconciling one to the other would just launder a bad parse into a bill that
 * looks trustworthy. We surface the gap and let a human resolve it.
 */

/** Currency comparisons tolerate a cent of float drift from summing line items. */
const TOLERANCE = 0.01;

export type ReconcileStatus =
  /** Line items sum to the receipt's printed subtotal. */
  | 'ok'
  /** They disagree — the parse dropped, added, or misread something. */
  | 'mismatch'
  /** No printed subtotal to compare against, so nothing can be concluded. */
  | 'unavailable';

export interface Reconciliation {
  status: ReconcileStatus;
  /** Sum of the line items we hold. */
  itemsSum: number;
  /** The receipt's own printed subtotal, per the parser. */
  receiptSubtotal: number | null;
  /**
   * receiptSubtotal - itemsSum, rounded to cents. Positive means the items fall
   * short of the receipt (something is missing); negative means they overshoot
   * (something was double-counted or invented). Null when unavailable.
   */
  difference: number | null;
}

/** Round to cents, avoiding float artifacts like 6.000000000000114. */
function toCents(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sumLineItems(items: { total_price: number }[]): number {
  return toCents(items.reduce((sum, i) => sum + i.total_price, 0));
}

/**
 * Compare the line items against the receipt's printed subtotal.
 *
 * `receiptSubtotal` is null whenever the parser could not read one, in which
 * case there is nothing to check and the result is 'unavailable' rather than a
 * mismatch — absence of a reading is not evidence of a bad parse.
 */
export function reconcileSubtotal(
  itemsSum: number,
  receiptSubtotal: number | null | undefined
): Reconciliation {
  const sum = toCents(itemsSum);

  if (receiptSubtotal == null) {
    return { status: 'unavailable', itemsSum: sum, receiptSubtotal: null, difference: null };
  }

  const printed = toCents(receiptSubtotal);
  const difference = toCents(printed - sum);

  return {
    status: Math.abs(difference) <= TOLERANCE ? 'ok' : 'mismatch',
    itemsSum: sum,
    receiptSubtotal: printed,
    difference,
  };
}

/**
 * Human-readable explanation of a mismatch, phrased as what to go look for.
 * Returns null when there is nothing to report.
 */
export function describeReconciliation(
  r: Reconciliation,
  format: (n: number) => string
): string | null {
  if (r.status !== 'mismatch' || r.difference == null) return null;

  const gap = format(Math.abs(r.difference));
  const items = format(r.itemsSum);
  const printed = format(r.receiptSubtotal!);

  return r.difference > 0
    ? `These items add up to ${items}, but the receipt's subtotal reads ${printed} — ${gap} is unaccounted for. An item was probably missed, or a price was read too low.`
    : `These items add up to ${items}, but the receipt's subtotal reads ${printed} — that's ${gap} too much. An item was probably counted twice, or a price was read too high.`;
}
