import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPlaceholderBill } from "@/app/actions/bills";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReceiptUpload } from "@/components/bills/ReceiptUpload";

export default async function NewBillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await createPlaceholderBill();

  if ("error" in result) {
    return <p className="p-4 text-destructive">{result.error}</p>;
  }

  return (
    <>
      <TopHeader title="Upload Receipt" backHref="/dashboard" />
      <PageContainer>
        <p className="text-sm text-muted-foreground mb-6">
          Take a photo of your receipt or upload one from your library.
        </p>
        <ReceiptUpload billId={result.billId} userId={user.id} />
      </PageContainer>
    </>
  );
}
