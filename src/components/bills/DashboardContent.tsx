"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardBills } from "@/app/actions/queries";
import { BillList } from "@/components/bills/BillList";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  currentUserId: string;
}

export function DashboardContent({ currentUserId }: Props) {
  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: getDashboardBills,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return <BillList bills={bills ?? []} currentUserId={currentUserId} />;
}
