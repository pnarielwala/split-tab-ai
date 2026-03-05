import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { BillContent } from "@/components/bills/BillContent";
import { Badge } from "@/components/ui/badge";
import { BillActionsMenu } from "@/components/bills/BillActionsMenu";
import { Button } from "@/components/ui/button";
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
  const status = statusLabels[bill.status] ?? statusLabels.draft;
  const headersList = await headers();
  const host = headersList.get("host");
  const proto = headersList.get("x-forwarded-proto") ?? "https";
  const shareUrl = `${proto}://${host}/join/${billId}`;

  let memberCount = 0;
  if (isOwner && bill.status === "verified") {
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
        actions={
          <>
            <Badge variant={status.variant}>{status.label}</Badge>
            {bill.status === "verified" && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/bills/${billId}/split`} className="gap-1.5">
                  <SplitSquareVertical className="h-4 w-4" />
                  Split
                </Link>
              </Button>
            )}
            <BillActionsMenu
              billId={billId}
              billName={bill.name}
              isOwner={isOwner}
              isVerified={bill.status === "verified"}
              shareUrl={shareUrl}
              receiptUrl={bill.receipt_url}
              memberCount={memberCount}
            />
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
        <BillContent billId={billId} currentUserId={user.id} />
      </PageContainer>
    </>
  );
}
