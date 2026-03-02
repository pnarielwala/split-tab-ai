import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SplitView } from "@/components/bills/SplitView";
import { ShareButton } from "@/components/bills/ShareButton";
import type { LineItemWithClaims, BillMemberWithProfile, Profile } from "@/types/database";

interface Props {
  params: Promise<{ billId: string }>;
}

export default async function SplitPage({ params }: Props) {
  const { billId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/bills/${billId}/split`);

  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .single();

  if (!bill) notFound();

  const isOwner = bill.owner_id === user.id;

  // Non-member, non-owner → redirect to join
  if (!isOwner) {
    const { data: membership } = await supabase
      .from("bill_members")
      .select("id")
      .eq("bill_id", billId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      redirect(`/join/${billId}`);
    }
  }

  const [
    { data: lineItemsRaw },
    { data: totals },
    { data: membersRaw },
    { data: ownerProfileRaw },
  ] = await Promise.all([
    supabase
      .from("line_items")
      .select("*, bill_item_claims(*, profiles(*))")
      .eq("bill_id", billId)
      .order("sort_order", { ascending: true }),
    supabase.from("bill_totals").select("*").eq("bill_id", billId).single(),
    supabase
      .from("bill_members")
      .select("*, profiles(*)")
      .eq("bill_id", billId),
    supabase.from("profiles").select("*").eq("id", bill.owner_id).single(),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shareUrl = `${appUrl}/join/${billId}`;

  return (
    <>
      <TopHeader
        title={bill.name}
        backHref={`/bills/${billId}`}
        actions={
          isOwner ? <ShareButton shareUrl={shareUrl} /> : undefined
        }
      />
      <PageContainer>
        <SplitView
          billId={billId}
          currentUserId={user.id}
          lineItems={(lineItemsRaw ?? []) as LineItemWithClaims[]}
          totals={totals ?? null}
          members={(membersRaw ?? []) as BillMemberWithProfile[]}
          ownerProfile={(ownerProfileRaw ?? { id: bill.owner_id, email: "", display_name: "Owner" }) as Profile}
        />
      </PageContainer>
    </>
  );
}
