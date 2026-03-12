'use client';

import { useQuery } from '@tanstack/react-query';
import { getBillPageData } from '@/app/actions/queries';
import { CostBreakdown } from '@/components/bills/CostBreakdown';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  billId: string;
  currentUserId: string;
}

export function BreakdownContent({ billId, currentUserId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['bill', billId],
    queryFn: () => getBillPageData(billId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data || data.shares.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No items have been claimed yet.
      </p>
    );
  }

  return (
    <CostBreakdown
      shares={data.shares}
      currency={data.totals?.currency ?? 'USD'}
      currentUserId={currentUserId}
    />
  );
}
