'use client';

import { useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { deleteBill } from '@/app/actions/bills';
import { getQueryClient } from '@/lib/get-query-client';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  billId: string;
  billName: string;
  variant?: 'icon' | 'full';
}

export function DeleteBillButton({
  billId,
  billName,
  variant = 'icon',
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const queryClient = useQueryClient();

  function handleDelete() {
    startTransition(async () => {
      queryClient.setQueryData<unknown[]>(['bills'], (old) =>
        old ? old.filter((b: any) => b.id !== billId) : old
      );
      setOpen(false);
      await deleteBill(billId);
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size={variant === 'icon' ? 'icon' : 'default'}
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Delete bill"
      >
        <Trash2 className="h-4 w-4" />
        {variant === 'full' && <span className="ml-2">Delete</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete bill?</DialogTitle>
            <DialogDescription>
              &ldquo;{billName}&rdquo; and all its line items will be
              permanently deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
            >
              {isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
