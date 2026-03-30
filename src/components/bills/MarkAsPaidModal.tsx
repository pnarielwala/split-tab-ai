'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { markAsPaid } from '@/app/actions/bills';

interface MarkAsPaidModalProps {
  billId: string;
  billName: string;
  payerName: string;
  currentUserIsPaid: boolean;
  onPaid?: () => void;
}

export function MarkAsPaidModal({
  billId,
  billName,
  payerName,
  currentUserIsPaid,
  onPaid,
}: MarkAsPaidModalProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (searchParams.get('action') === 'mark-paid') {
      setOpen(true);
    }
  }, [searchParams]);

  function cleanUrl() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('action');
    const search = params.toString();
    router.replace(search ? `?${search}` : window.location.pathname);
  }

  function handleOpenChange(value: boolean) {
    if (!value) cleanUrl();
    setOpen(value);
  }

  function handleConfirm() {
    startTransition(async () => {
      await markAsPaid(billId);
      toast.success("You're marked as paid!");
      onPaid?.();
      setOpen(false);
      cleanUrl();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Mark yourself as paid</DialogTitle>
          <DialogDescription>
            {currentUserIsPaid
              ? `You're already marked as paid for ${billName}.`
              : `Confirm that you've paid ${payerName} for ${billName}.`}
          </DialogDescription>
        </DialogHeader>
        {currentUserIsPaid ? (
          <p className="text-sm text-green-600 font-medium">
            You&apos;re already marked as paid ✓
          </p>
        ) : (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={isPending}
              onClick={handleConfirm}
            >
              {isPending ? 'Saving…' : "Yes, I've paid"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
