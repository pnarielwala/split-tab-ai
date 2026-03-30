'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { updateBillPayer } from '@/app/actions/bills';

interface Participant {
  userId: string;
  displayName: string;
}

interface ChangePayerButtonProps {
  billId: string;
  currentPayerId: string;
  participants: Participant[];
  onSuccess?: () => void;
  disabled?: boolean;
}

export function ChangePayerButton({
  billId,
  currentPayerId,
  participants,
  onSuccess,
  disabled,
}: ChangePayerButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(currentPayerId);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (selected === currentPayerId) {
      setOpen(false);
      return;
    }
    setLoading(true);
    const result = await updateBillPayer(billId, selected);
    setLoading(false);
    if ('error' in result) {
      toast.error(result.error);
    } else {
      setOpen(false);
      onSuccess ? onSuccess() : router.refresh();
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => {
          setSelected(currentPayerId);
          setOpen(true);
        }}
      >
        <ArrowLeftRight className="h-4 w-4" />
        Change payer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Who paid?</DialogTitle>
            <DialogDescription>
              {disabled
                ? 'The payer cannot be changed once someone has marked themselves as paid.'
                : 'Select the person who paid for this bill. Everyone else will owe them.'}
            </DialogDescription>
          </DialogHeader>

          {!disabled && (
            <div className="space-y-1">
              {participants.map((p) => (
                <button
                  key={p.userId}
                  onClick={() => setSelected(p.userId)}
                  className={`w-full text-left rounded-md border px-3 py-2.5 text-sm transition-colors ${
                    selected === p.userId
                      ? 'border-primary bg-primary/5 font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  {p.displayName}
                  {p.userId === currentPayerId && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (current)
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            {disabled ? (
              <Button onClick={() => setOpen(false)}>Got it</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading ? 'Saving…' : 'Confirm'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
