export interface ParsedLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedReceipt {
  restaurantName: string | null;
  lineItems: ParsedLineItem[];
  subtotal: number | null;
  tax: number | null;
  gratuity: number | null;
  fees: number | null;
  discounts: number | null;
  total: number | null;
  currency: string;
  notes: string | null;
}
