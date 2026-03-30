'use client';

import { useTransition } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { archiveBill, unarchiveBill } from '@/app/actions/bills';
import { useQueryClient } from '@tanstack/react-query';
import type { DashboardBill } from '@/app/actions/queries';

interface Props {
  billId: string;
  isArchived: boolean;
}

export function ArchiveBillButton({ billId, isArchived }: Props) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  function handleToggle() {
    startTransition(async () => {
      queryClient.setQueryData<DashboardBill[]>(['bills'], (old) =>
        old ? old.map((b) => b.id === billId ? { ...b, is_archived: !isArchived } : b) : old
      );
      if (isArchived) {
        await unarchiveBill(billId);
      } else {
        await archiveBill(billId);
      }
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={isPending}
      className="text-muted-foreground hover:text-foreground"
      aria-label={isArchived ? 'Unarchive bill' : 'Archive bill'}
    >
      {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
    </Button>
  );
}
