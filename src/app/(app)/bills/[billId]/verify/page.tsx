import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReceiptVerify } from "@/components/bills/ReceiptVerify";

interface Props {
  params: Promise<{ billId: string }>;
}

export default async function VerifyPage({ params }: Props) {
  const { billId } = await params;
  const supabase = await createClient();

  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .single();

  if (!bill) notFound();
  if (bill.status === "verified") redirect(`/bills/${billId}`);
  if (bill.status === "draft") redirect(`/bills/${billId}/upload`);

  const { data: lineItems } = await supabase
    .from("line_items")
    .select("*")
    .eq("bill_id", billId)
    .order("sort_order", { ascending: true });

  const { data: totals } = await supabase
    .from("bill_totals")
    .select("*")
    .eq("bill_id", billId)
    .single();

  return (
    <>
      <TopHeader title="Verify Receipt" backHref="/dashboard" />
      <PageContainer>
        <div className="space-y-1 mb-4">
          <h2 className="font-semibold text-lg">{bill.name}</h2>
          <p className="text-sm text-muted-foreground">
            Review the items extracted from your receipt. Tap any item to edit.
          </p>
        </div>
        <ReceiptVerify
          billId={billId}
          lineItems={lineItems ?? []}
          totals={totals ?? null}
          receiptUrl={bill.receipt_url ?? ""}
        />
      </PageContainer>
    </>
  );
}
