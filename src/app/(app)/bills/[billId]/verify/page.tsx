import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReceiptVerify } from "@/components/bills/ReceiptVerify";
import { ViewReceiptButton } from "@/components/bills/ViewReceiptButton";

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
      <TopHeader
        title="Verify Receipt"
        backHref="/dashboard"
        actions={bill.receipt_url ? <ViewReceiptButton receiptUrl={bill.receipt_url} /> : undefined}
      />
      <PageContainer>
        <ReceiptVerify
          billId={billId}
          lineItems={lineItems ?? []}
          totals={totals ?? null}
          receiptUrl={bill.receipt_url ?? ""}
          initialName={bill.name}
          initialDescription={bill.description ?? ""}
        />
      </PageContainer>
    </>
  );
}
