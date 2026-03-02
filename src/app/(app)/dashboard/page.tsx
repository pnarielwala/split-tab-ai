import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BillList } from "@/components/bills/BillList";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import type { Bill, BillTotal } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentUserId = user?.id ?? "";

  // Owned bills
  const { data: ownedBills } = await supabase
    .from("bills")
    .select("*, bill_totals(*)")
    .eq("owner_id", currentUserId)
    .order("created_at", { ascending: false });

  // Bills joined as a member (not owned)
  const { data: memberships } = await supabase
    .from("bill_members")
    .select("bill_id, bills(*, bill_totals(*))")
    .eq("user_id", currentUserId);

  // Merge, deduplicate by id, sort newest first
  const billMap = new Map<string, Bill & { bill_totals: BillTotal | null }>();

  for (const bill of ownedBills ?? []) {
    const totals = Array.isArray(bill.bill_totals) ? (bill.bill_totals[0] ?? null) : bill.bill_totals;
    billMap.set(bill.id, { ...bill, bill_totals: totals });
  }

  for (const m of memberships ?? []) {
    const bill = (m.bills as unknown) as (Bill & { bill_totals: BillTotal | BillTotal[] | null }) | null;
    if (!bill || billMap.has(bill.id)) continue;
    const totals = Array.isArray(bill.bill_totals) ? (bill.bill_totals[0] ?? null) : bill.bill_totals;
    billMap.set(bill.id, { ...bill, bill_totals: totals });
  }

  const bills = Array.from(billMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <>
      <TopHeader title="My Bills" />
      <PageContainer>
        <BillList bills={bills} currentUserId={currentUserId} />
      </PageContainer>

      {/* FAB */}
      <Link
        href="/bills/new"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="New bill"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
}
