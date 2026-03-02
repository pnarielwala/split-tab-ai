import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReceiptUpload } from "@/components/bills/ReceiptUpload";

interface Props {
  params: Promise<{ billId: string }>;
}

export default async function UploadPage({ params }: Props) {
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

  // If already parsed/verified, send to appropriate page
  if (bill.status === "parsed") redirect(`/bills/${billId}/verify`);
  if (bill.status === "verified") redirect(`/bills/${billId}`);

  return (
    <>
      <TopHeader title="Upload Receipt" backHref="/dashboard" />
      <PageContainer>
        <div className="space-y-2 mb-6">
          <h2 className="font-semibold text-lg">{bill.name}</h2>
          <p className="text-sm text-muted-foreground">
            Take a photo of your receipt or upload one from your library.
          </p>
        </div>
        <ReceiptUpload billId={billId} userId={user.id} />
      </PageContainer>
    </>
  );
}
