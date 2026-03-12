import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinBill } from "@/app/actions/bills";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

interface Props {
  params: Promise<{ billId: string }>;
}

export default async function JoinBillPage({ params }: Props) {
  const { billId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/join/${billId}`);

  const { data: bill } = await supabase
    .from("bills")
    .select("*")
    .eq("id", billId)
    .single();

  if (!bill) notFound();

  // Owner → skip join, go directly to bill
  if (bill.owner_id === user.id) {
    redirect(`/bills/${billId}`);
  }

  // Already a member → go to bill
  const { data: existing } = await supabase
    .from("bill_members")
    .select("id")
    .eq("bill_id", billId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    redirect(`/bills/${billId}`);
  }

  // Count existing participants (owner + members)
  const { count: memberCount } = await supabase
    .from("bill_members")
    .select("*", { count: "exact", head: true })
    .eq("bill_id", billId);

  const participantCount = (memberCount ?? 0) + 1; // +1 for owner

  return (
    <>
      <TopHeader title="Join Bill" backHref="/dashboard" />
      <PageContainer>
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-xl font-semibold">{bill.name}</h2>
              {bill.description && (
                <p className="text-sm text-muted-foreground">{bill.description}</p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {participantCount} participant{participantCount !== 1 ? "s" : ""} so far
                </span>
              </div>
            </CardContent>
          </Card>

          <form
            action={async () => {
              "use server";
              await joinBill(billId);
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Join this bill
            </Button>
          </form>
        </div>
      </PageContainer>
    </>
  );
}
