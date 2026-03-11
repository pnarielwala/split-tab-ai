import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { TopHeader } from '@/components/layout/TopHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { DashboardContent } from '@/components/bills/DashboardContent';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <TopHeader title="Dashboard" />
      <PageContainer>
        <DashboardContent currentUserId={user?.id ?? ''} />
      </PageContainer>

      {/* FAB */}
      <Link
        href="/bills/new"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="New bill"
      >
        <Plus className="h-6 w-6" />
      </Link>
    </>
  );
}
