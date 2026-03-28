'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BillList } from '@/components/bills/BillList';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { DashboardBill } from '@/app/actions/queries';

type Filter = 'all' | 'created' | 'joined';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'joined', label: 'Joined' },
];

interface Props {
  currentUserId: string;
}

async function fetchBills(): Promise<DashboardBill[]> {
  const res = await fetch('/api/bills');
  if (!res.ok) throw new Error('Failed to fetch bills');
  return res.json();
}

export function DashboardContent({ currentUserId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const filter: Filter = rawTab === 'created' || rawTab === 'joined' ? rawTab : 'all';

  function setFilter(value: Filter) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', value);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const { data: bills, isLoading } = useQuery({
    queryKey: ['bills'],
    queryFn: fetchBills,
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

  const filtered = (bills ?? []).filter((b) => {
    if (filter === 'created') return b.owner_id === currentUserId;
    if (filter === 'joined') return b.owner_id !== currentUserId;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={cn(
              'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <BillList bills={filtered} currentUserId={currentUserId} />
    </div>
  );
}
