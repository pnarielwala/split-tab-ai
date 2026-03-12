'use client';

import { useQuery } from '@tanstack/react-query';
import { getBillPageData } from '@/app/actions/queries';
import { BillSummary } from '@/components/bills/BillSummary';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  billId: string;
}

export function BillContent({ billId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['bill', billId],
    queryFn: () => getBillPageData(billId),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return <BillSummary lineItems={data.lineItems} totals={data.totals ?? null} />;
}
