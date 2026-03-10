"use client";

import { useQuery } from "@tanstack/react-query";
import { BillList } from "@/components/bills/BillList";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardBill } from "@/app/actions/queries";

interface Props {
  currentUserId: string;
}

async function fetchBills(): Promise<DashboardBill[]> {
  const res = await fetch("/api/bills");
  if (!res.ok) throw new Error("Failed to fetch bills");
  return res.json();
}

export function DashboardContent({ currentUserId }: Props) {
  const { data: bills, isLoading } = useQuery({
    queryKey: ["bills"],
    queryFn: fetchBills,
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
