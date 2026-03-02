export type BillStatus = 'draft' | 'uploaded' | 'parsed' | 'verified';

export interface Bill {
  id: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  name: string;
  description: string | null;
  status: BillStatus;
  receipt_path: string | null;
  receipt_url: string | null;
}

export interface LineItem {
  id: string;
  bill_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

export interface BillTotal {
  bill_id: string;
  subtotal: number | null;
  tax: number | null;
  gratuity: number | null;
  total: number | null;
  currency: string;
}

export interface BillWithDetails extends Bill {
  line_items: LineItem[];
  bill_totals: BillTotal | null;
}
