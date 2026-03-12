import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BillContent } from "@/components/bills/BillContent";
import { BillDetail } from "@/components/bills/BillDetail";
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
  const isVerified = bill.status === "verified";
  const status = statusLabels[bill.status] ?? statusLabels.draft;

  // Non-member visiting a verified bill → redirect to join flow
  if (isVerified && !isOwner) {
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

  let memberCount = 0;
  if (isOwner && isVerified) {
    const { count } = await supabase
      .from("bill_members")
      .select("id", { count: "exact", head: true })
      .eq("bill_id", billId);
    memberCount = count ?? 0;
  }

  return (
    <>
      <TopHeader
        backHref="/dashboard"
        title={isVerified ? "Select your items" : undefined}
        actions={
          <>
            <Badge variant={status.variant}>{status.label}</Badge>
            {isOwner && (
              <DeleteBillButton billId={billId} billName={bill.name} />
            )}
          </>
        }
      />
      <PageContainer>
        <div className="mb-4">
          <h1 className="text-xl font-bold">{bill.name}</h1>
          {bill.description && (
            <p className="text-sm text-muted-foreground mt-1">{bill.description}</p>
          )}
        </div>
        {isVerified ? (
          <BillDetail
            billId={billId}
            currentUserId={user.id}
            isOwner={isOwner}
            shareUrl={shareUrl}
            receiptUrl={bill.receipt_url}
            memberCount={memberCount}
            billName={bill.name}
          />
        ) : (
          <BillContent billId={billId} />
        )}
      </PageContainer>
    </>
  );
}
