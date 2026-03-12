'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBillPageData } from '@/app/actions/queries';
import { markAsPaid, markAsUnpaid } from '@/app/actions/bills';
import { CostBreakdown } from '@/components/bills/CostBreakdown';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  billId: string;
  currentUserId: string;
  isPayer: boolean;
}

export function BreakdownContent({ billId, currentUserId, isPayer }: Props) {
  const queryClient = useQueryClient();
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

  const onTogglePaid = isPayer
    ? async (userId: string, currentlyPaid: boolean) => {
        if (currentlyPaid) {
          await markAsUnpaid(billId, userId);
        } else {
          await markAsPaid(billId, userId);
        }
        queryClient.invalidateQueries({ queryKey: ['bill', billId] });
      }
    : undefined;

  return (
    <CostBreakdown
      shares={data.shares}
      currency={data.totals?.currency ?? 'USD'}
      currentUserId={currentUserId}
      paidUserIds={data.paidUserIds}
      payerId={data.payerId}
      onTogglePaid={onTogglePaid}
    />
  );
}
