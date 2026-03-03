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
  fees: number | null;
  discounts: number | null;
  total: number | null;
  currency: string;
}

export interface BillWithDetails extends Bill {
  line_items: LineItem[];
  bill_totals: BillTotal | null;
}

export interface Profile {
  id: string;
  email: string | null;  // null for phone-only users
  display_name: string;
}

export interface BillMember {
  id: string;
  bill_id: string;
  user_id: string;
  joined_at: string;
}

export interface BillMemberWithProfile extends BillMember {
  profiles: Profile;
}

export interface BillItemClaim {
  id: string;
  item_id: string;
  user_id: string;
  claimed_at: string;
}

export interface BillItemClaimWithProfile extends BillItemClaim {
  profiles: Profile;
}

export interface LineItemWithClaims extends LineItem {
  bill_item_claims: BillItemClaimWithProfile[];
}

export interface ParticipantShare {
  userId: string;
  displayName: string;
  subtotal: number;
  tax: number;
  gratuity: number;
  fees: number;
  discounts: number;
  total: number;
}
