import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SplitView } from "@/components/bills/SplitView";
import { ShareButton } from "@/components/bills/ShareButton";

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

  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/join/${billId}`;

  return (
    <>
      <TopHeader
        title={bill.name}
        backHref={`/bills/${billId}`}
        actions={isOwner ? <ShareButton shareUrl={shareUrl} /> : undefined}
      />
      <PageContainer>
        <SplitView billId={billId} currentUserId={user.id} />
      </PageContainer>
    </>
  );
}
