"use client";

import { useQuery } from "@tanstack/react-query";
import { getBillPageData } from "@/app/actions/queries";
import { BillSummary } from "@/components/bills/BillSummary";
import { CostBreakdown } from "@/components/bills/CostBreakdown";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  billId: string;
  currentUserId: string;
}

export function BillContent({ billId, currentUserId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["bill", billId],
    queryFn: () => getBillPageData(billId),
    staleTime: 30_000,
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

  const { lineItems, totals, shares } = data;

  return (
    <div className="space-y-6">
      <BillSummary lineItems={lineItems} totals={totals ?? null} />
      {shares.length > 0 && (
        <CostBreakdown
          shares={shares}
          currency={totals?.currency ?? "USD"}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
