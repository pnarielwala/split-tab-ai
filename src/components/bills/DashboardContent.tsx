'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [archivedOpen, setArchivedOpen] = useState(false);
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

  const activeBills = filtered.filter((b) => !b.is_archived);
  const archivedBills = filtered.filter((b) => b.is_archived);

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
      <BillList bills={activeBills} currentUserId={currentUserId} />
      {archivedBills.length > 0 && (
        <div className="mt-2">
          <button
            onClick={() => setArchivedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={archivedOpen}
          >
            <span>Archived ({archivedBills.length})</span>
            {archivedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {archivedOpen && (
            <div className="mt-2 opacity-60">
              <BillList bills={archivedBills} currentUserId={currentUserId} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
