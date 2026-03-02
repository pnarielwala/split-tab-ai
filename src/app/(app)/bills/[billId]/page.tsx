import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BillSummary } from "@/components/bills/BillSummary";
import { Badge } from "@/components/ui/badge";
import { DeleteBillButton } from "@/components/bills/DeleteBillButton";

interface Props {
  params: Promise<{ billId: string }>;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  uploaded: { label: "Processing", variant: "secondary" },
  parsed: { label: "Review needed", variant: "default" },
  verified: { label: "Verified", variant: "secondary" },
};

export default async function BillPage({ params }: Props) {
  const { billId } = await params;
  const supabase = await createClient();

  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .single();

  if (!bill) notFound();

  const [{ data: lineItems }, { data: totals }] = await Promise.all([
    supabase
      .from("line_items")
      .select("*")
      .eq("bill_id", billId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("bill_totals")
      .select("*")
      .eq("bill_id", billId)
      .single(),
  ]);

  const status = statusLabels[bill.status] ?? statusLabels.draft;

  return (
    <>
      <TopHeader
        title={bill.name}
        backHref="/dashboard"
        actions={
          <>
            <Badge variant={status.variant}>{status.label}</Badge>
            <DeleteBillButton billId={billId} billName={bill.name} />
          </>
        }
      />
      <PageContainer>
        {bill.description && (
          <p className="text-sm text-muted-foreground mb-4">{bill.description}</p>
        )}
        <BillSummary lineItems={lineItems ?? []} totals={totals ?? null} />
      </PageContainer>
    </>
  );
}
