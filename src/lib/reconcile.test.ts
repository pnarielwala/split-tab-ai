import { expect, test, describe } from 'bun:test';
import { reconcileSubtotal, sumLineItems, describeReconciliation } from './reconcile';

const fmt = (n: number) => `$${n.toFixed(2)}`;

/**
 * Local Cantina check 78 — the receipt that motivated this check.
 *
 * Its amount column is printed one text line above the item names, so reading
 * each price off the row it appears to sit on pairs every item with its
 * neighbour's price and leaves the last row unpriced. The 19 correct line
 * item prices, in printed order:
 */
const PRICES = [14, 14, 14, 14, 19, 14, 14, 14, 14, 14, 15, 15, 22, 24, 15, 7, 7, 51, 6];
const PRINTED_SUBTOTAL = 307.0;

const items = (prices: number[]) => prices.map((total_price) => ({ total_price }));

describe('the Local Cantina receipt', () => {
  test('a correct parse reconciles against the printed subtotal', () => {
    const sum = sumLineItems(items(PRICES));
    expect(sum).toBe(307);

    const r = reconcileSubtotal(sum, PRINTED_SUBTOTAL);
    expect(r.status).toBe('ok');
    expect(r.difference).toBe(0);
    expect(describeReconciliation(r, fmt)).toBeNull();
  });

  test('a dropped duplicate row is caught', () => {
    // One of the two adjacent "Side Street Corn" rows (7.00) is collapsed away.
    const dropped = PRICES.filter((_, i) => i !== 16);
    const r = reconcileSubtotal(sumLineItems(items(dropped)), PRINTED_SUBTOTAL);

    expect(r.itemsSum).toBe(300);
    expect(r.status).toBe('mismatch');
    expect(r.difference).toBe(7);
    expect(describeReconciliation(r, fmt)).toContain('$7.00 is unaccounted for');
  });

  test('a price column read one row off is caught', () => {
    // Every item takes the price printed on the row it appears to sit on, which
    // belongs to the next item down; the final row is left unpriced.
    const shifted = PRICES.slice(1);
    const r = reconcileSubtotal(sumLineItems(items(shifted)), PRINTED_SUBTOTAL);

    expect(r.itemsSum).toBe(293);
    expect(r.status).toBe('mismatch');
    expect(r.difference).toBe(14);
  });

  test('repairing the items clears the mismatch', () => {
    const dropped = PRICES.filter((_, i) => i !== 16);
    const repaired = [...dropped, 7];
    expect(reconcileSubtotal(sumLineItems(items(repaired)), PRINTED_SUBTOTAL).status).toBe('ok');
  });
});

describe('reconcileSubtotal', () => {
  test('reports unavailable when the receipt had no readable subtotal', () => {
    const r = reconcileSubtotal(300, null);
    expect(r.status).toBe('unavailable');
    expect(r.difference).toBeNull();
    expect(describeReconciliation(r, fmt)).toBeNull();
  });

  test('treats undefined like null rather than zero', () => {
    expect(reconcileSubtotal(300, undefined).status).toBe('unavailable');
  });

  test('a zero printed subtotal is a real reading, not a missing one', () => {
    const r = reconcileSubtotal(300, 0);
    expect(r.status).toBe('mismatch');
    expect(r.difference).toBe(-300);
  });

  test('flags items that overshoot the receipt', () => {
    const r = reconcileSubtotal(314, PRINTED_SUBTOTAL);
    expect(r.status).toBe('mismatch');
    expect(r.difference).toBe(-7);
    expect(describeReconciliation(r, fmt)).toContain("that's $7.00 too much");
  });

  test('absorbs float drift from summing many items', () => {
    const r = reconcileSubtotal(sumLineItems(items(Array(30).fill(0.1))), 3.0);
    expect(r.status).toBe('ok');
  });

  test('a one-cent gap is within tolerance, two cents is not', () => {
    expect(reconcileSubtotal(306.99, PRINTED_SUBTOTAL).status).toBe('ok');
    expect(reconcileSubtotal(306.98, PRINTED_SUBTOTAL).status).toBe('mismatch');
  });

  test('an empty bill against a printed subtotal is a mismatch', () => {
    const r = reconcileSubtotal(sumLineItems([]), PRINTED_SUBTOTAL);
    expect(r.status).toBe('mismatch');
    expect(r.difference).toBe(307);
  });

  test('an empty bill with no printed subtotal is unavailable', () => {
    expect(reconcileSubtotal(sumLineItems([]), null).status).toBe('unavailable');
  });
});
