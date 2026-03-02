import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BillList } from "@/components/bills/BillList";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: bills } = await supabase
    .from("bills")
    .select("*, bill_totals(*)")
    .order("created_at", { ascending: false });

  return (
    <>
      <TopHeader title="My Bills" />
      <PageContainer>
        <BillList bills={bills ?? []} />
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
