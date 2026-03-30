import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { BackButton } from "@/components/layout/BackButton";
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
    .select("owner_id, payer_id, status")
    .eq("id", billId)
    .single();

  if (!bill) notFound();
  if (bill.status !== "verified" && bill.status !== "locked") redirect(`/bills/${billId}`);

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billAny = bill as any;
  const isPayer = (billAny.payer_id ?? bill.owner_id) === user.id;

  return (
    <>
      <TopHeader title="Split summary" backButton={<BackButton fallbackHref={`/bills/${billId}`} />} />
      <PageContainer>
        <BreakdownContent billId={billId} currentUserId={user.id} isPayer={isPayer} />
      </PageContainer>
    </>
  );
}
