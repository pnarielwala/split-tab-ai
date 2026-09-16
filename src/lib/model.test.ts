import { expect, test, describe } from 'bun:test';
import { RECEIPT_SCHEMA } from './model';
import type { ParsedReceipt } from '@/types/receipt';

/**
 * Gemini accepts only a subset of JSON Schema for `responseJsonSchema`. An
 * unsupported keyword is rejected at request time, which would take receipt
 * parsing down entirely, so the schema is pinned to the documented subset here.
 */
const SUPPORTED_KEYWORDS = new Set([
  '$id',
  '$defs',
  '$ref',
  '$anchor',
  'type',
  'format',
  'title',
  'description',
  'enum',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'anyOf',
  'oneOf',
  'properties',
  'additionalProperties',
  'required',
  'propertyOrdering',
]);

/** Every keyword used anywhere in the schema tree. */
function keywordsIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const child of node) keywordsIn(child, found);
    return found;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      found.add(key);
      // Values under `properties` are field names, not keywords.
      if (key === 'properties' && value && typeof value === 'object') {
        for (const sub of Object.values(value)) keywordsIn(sub, found);
      } else {
        keywordsIn(value, found);
      }
    }
  }
  return found;
}

const schema = RECEIPT_SCHEMA as {
  properties: Record<string, unknown>;
  required: string[];
};

describe('RECEIPT_SCHEMA', () => {
  test('uses only JSON Schema keywords Gemini supports', () => {
    const used = [...keywordsIn(RECEIPT_SCHEMA)].filter(
      (k) => !Object.keys(schema.properties).includes(k)
    );
    const unsupported = used.filter((k) => !SUPPORTED_KEYWORDS.has(k));
    expect(unsupported).toEqual([]);
  });

  test('does not use array-valued `type`, which is not supported', () => {
    const json = JSON.stringify(RECEIPT_SCHEMA);
    expect(json).not.toMatch(/"type":\s*\[/);
  });

  test('every field is required, so no field can come back absent', () => {
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
  });

  test('covers exactly the fields ParsedReceipt declares', () => {
    // Compile-time: this object must satisfy ParsedReceipt, so the key list
    // below cannot drift from the type without a type error here.
    const reference: ParsedReceipt = {
      restaurantName: null,
      lineItems: [],
      subtotal: null,
      tax: null,
      gratuity: null,
      fees: null,
      discounts: null,
      total: null,
      currency: 'USD',
      notes: null,
    };
    expect(Object.keys(schema.properties).sort()).toEqual(Object.keys(reference).sort());
  });

  test('line items require a name and all three amounts', () => {
    const lineItems = schema.properties.lineItems as {
      items: { required: string[]; properties: Record<string, unknown> };
    };
    expect([...lineItems.items.required].sort()).toEqual([
      'name',
      'quantity',
      'totalPrice',
      'unitPrice',
    ]);
    expect(Object.keys(lineItems.items.properties).sort()).toEqual([
      'name',
      'quantity',
      'totalPrice',
      'unitPrice',
    ]);
  });

  test('nullable fields accept both their type and null', () => {
    for (const field of ['restaurantName', 'subtotal', 'tax', 'total', 'notes']) {
      const prop = schema.properties[field] as { anyOf: { type: string }[] };
      expect(prop.anyOf.map((t) => t.type)).toContain('null');
      expect(prop.anyOf).toHaveLength(2);
    }
  });

  test('currency is not nullable — the route relies on a value', () => {
    expect(schema.properties.currency).toEqual({ type: 'string' });
  });
});
