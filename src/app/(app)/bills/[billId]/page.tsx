import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { BackButton } from "@/components/layout/BackButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { BillContent } from "@/components/bills/BillContent";
import { BillDetail } from "@/components/bills/BillDetail";
import { Badge } from "@/components/ui/badge";
import { DeleteBillButton } from "@/components/bills/DeleteBillButton";
import { WhatDoIDoHeaderButton } from "@/components/bills/WhatDoIDoHeaderButton";
import { Users } from "lucide-react";
import { formatShortDate } from "@/lib/utils";

interface Props {
  params: Promise<{ billId: string }>;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  uploaded: { label: "Processing", variant: "secondary" },
  parsed: { label: "Review needed", variant: "default" },
  verified: { label: "Verified", variant: "secondary" },
  locked: { label: "Locked", variant: "secondary" },
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

  const { count: memberCount } = await supabase
    .from("bill_members")
    .select("id", { count: "exact", head: true })
    .eq("bill_id", billId);

  const isOwner = bill.owner_id === user.id;
  const isVerified = bill.status === "verified";
  const isLocked = bill.status === "locked";
  const showDetail = isVerified || isLocked;
  const status = statusLabels[bill.status] ?? statusLabels.draft;

  // Non-member visiting a verified/locked bill → redirect to join flow
  if (showDetail && !isOwner) {
    const { data: membership } = await supabase
      .from("bill_members")
      .select("id")
      .eq("bill_id", billId)
      .eq("user_id", user.id)
      .single();

    if (!membership) redirect(`/join/${billId}`);
  }

  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/join/${billId}`;

  return (
    <>
      <TopHeader
        backButton={<BackButton fallbackHref="/dashboard" />}
        title={showDetail ? (isLocked ? "Bill locked" : "Select your items") : undefined}
        actions={
          <>
            {showDetail && (
              <Suspense fallback={null}>
                <WhatDoIDoHeaderButton
                  billId={billId}
                  currentUserId={user.id}
                  isOwner={isOwner}
                />
              </Suspense>
            )}
            {isOwner && (
              <DeleteBillButton billId={billId} billName={bill.name} />
            )}
          </>
        }
      />
      <PageContainer>
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{bill.name}</h1>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {(memberCount ?? 0) + 1}
            </span>
            <Badge variant={status.variant} className="ml-auto">{status.label}</Badge>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            {bill.description && (
              <p className="text-sm text-muted-foreground">{bill.description}</p>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {formatShortDate(bill.created_at)}
            </span>
          </div>
        </div>
        {showDetail ? (
          <BillDetail
            billId={billId}
            currentUserId={user.id}
            isOwner={isOwner}
            shareUrl={shareUrl}
            receiptUrl={bill.receipt_url}
            billName={bill.name}
          />
        ) : (
          <BillContent billId={billId} isOwner={isOwner} />
        )}
      </PageContainer>
    </>
  );
}
