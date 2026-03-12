import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BreakdownContent } from "@/components/bills/BreakdownContent";

interface Props {
  params: Promise<{ billId: string }>;
}

export default async function BreakdownPage({ params }: Props) {
  const { billId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/bills/${billId}/breakdown`);

  const { data: bill } = await supabase
    .from("bills")
    .select("owner_id, status")
    .eq("id", billId)
    .single();

  if (!bill) notFound();
  if (bill.status !== "verified") redirect(`/bills/${billId}`);

  const isOwner = bill.owner_id === user.id;
  if (!isOwner) {
    const { data: membership } = await supabase
      .from("bill_members")
      .select("id")
      .eq("bill_id", billId)
      .eq("user_id", user.id)
      .single();
    if (!membership) redirect(`/bills/${billId}`);
  }

  return (
    <>
      <TopHeader title="Split summary" backHref={`/bills/${billId}`} />
      <PageContainer>
        <BreakdownContent billId={billId} currentUserId={user.id} />
      </PageContainer>
    </>
  );
}
