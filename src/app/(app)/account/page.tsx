import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopHeader } from "@/components/layout/TopHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <>
      <TopHeader title="Account" />
      <PageContainer>
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </PageContainer>
    </>
  );
}
