import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BillSummary } from "@/components/bills/BillSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteBillButton } from "@/components/bills/DeleteBillButton";
import { ShareButton } from "@/components/bills/ShareButton";
import { SplitSquareVertical } from "lucide-react";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .single();

  if (!bill) notFound();

  const isOwner = bill.owner_id === user.id;

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = `${appUrl}/join/${billId}`;

  return (
    <>
      <TopHeader
        title={bill.name}
        backHref="/dashboard"
        actions={
          <>
            <Badge variant={status.variant}>{status.label}</Badge>
            {bill.status === "verified" && (
              <>
                <ShareButton shareUrl={shareUrl} />
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/bills/${billId}/split`} className="gap-1.5">
                    <SplitSquareVertical className="h-4 w-4" />
                    Split
                  </Link>
                </Button>
              </>
            )}
            {isOwner && <DeleteBillButton billId={billId} billName={bill.name} />}
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
