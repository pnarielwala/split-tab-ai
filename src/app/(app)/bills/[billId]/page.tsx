import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BillSummary } from "@/components/bills/BillSummary";
import { CostBreakdown } from "@/components/bills/CostBreakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteBillButton } from "@/components/bills/DeleteBillButton";
import { ShareButton } from "@/components/bills/ShareButton";
import { SplitSquareVertical } from "lucide-react";
import type { LineItemWithClaims, BillMemberWithProfile, ParticipantShare } from "@/types/database";

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

  const [{ data: lineItemsRaw }, { data: totals }, { data: membersRaw }, { data: ownerProfile }] = await Promise.all([
    supabase
      .from("line_items")
      .select("*, bill_item_claims(*, profiles(*))")
      .eq("bill_id", billId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("bill_totals")
      .select("*")
      .eq("bill_id", billId)
      .single(),
    supabase
      .from("bill_members")
      .select("*, profiles(*)")
      .eq("bill_id", billId),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", bill.owner_id)
      .single(),
  ]);

  const lineItems = (lineItemsRaw ?? []) as LineItemWithClaims[];
  const members = (membersRaw ?? []) as BillMemberWithProfile[];

  // Compute per-participant cost shares
  const participantMap = new Map<string, string>();
  participantMap.set(bill.owner_id, ownerProfile?.display_name ?? "Owner");
  for (const m of members) {
    participantMap.set(m.user_id, m.profiles.display_name);
  }

  const billSubtotal = totals?.subtotal ?? 0;
  const billTax = totals?.tax ?? 0;
  const billGratuity = totals?.gratuity ?? 0;
  const subtotals = new Map<string, number>();
  for (const item of lineItems) {
    const count = item.bill_item_claims.length;
    if (count === 0) continue;
    const share = item.total_price / count;
    for (const claim of item.bill_item_claims) {
      subtotals.set(claim.user_id, (subtotals.get(claim.user_id) ?? 0) + share);
    }
  }

  const shares: ParticipantShare[] = [];
  for (const [userId, displayName] of participantMap.entries()) {
    const sub = subtotals.get(userId) ?? 0;
    if (sub === 0) continue;
    const ratio = billSubtotal > 0 ? sub / billSubtotal : 0;
    shares.push({
      userId,
      displayName,
      subtotal: sub,
      tax: billTax * ratio,
      gratuity: billGratuity * ratio,
      total: sub + billTax * ratio + billGratuity * ratio,
    });
  }
  shares.sort((a, b) => b.total - a.total);

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
        <div className="space-y-6">
          <BillSummary lineItems={lineItems} totals={totals ?? null} />
          {shares.length > 0 && (
            <CostBreakdown shares={shares} currency={totals?.currency ?? "USD"} currentUserId={user.id} />
          )}
        </div>
      </PageContainer>
    </>
  );
}
