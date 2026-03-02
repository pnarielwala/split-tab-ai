export interface ParsedLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedReceipt {
  lineItems: ParsedLineItem[];
  subtotal: number | null;
  tax: number | null;
  gratuity: number | null;
  total: number | null;
  currency: string;
  notes: string | null;
}
