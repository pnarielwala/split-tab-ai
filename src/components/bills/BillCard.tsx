import Link from 'next/link';
import { formatDistanceToNow, formatCurrency, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Bill, BillTotal } from '@/types/database';
import { ChevronRight, Users } from 'lucide-react';
import { DeleteBillButton } from '@/components/bills/DeleteBillButton';
import { ArchiveBillButton } from '@/components/bills/ArchiveBillButton';

const contextualStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  ready_to_claim: { label: 'Ready to claim', className: 'text-amber-500' },
  waiting_for_lock: { label: 'Waiting for lock', className: 'text-muted-foreground' },
  unpaid: { label: 'Unpaid', className: 'text-red-500' },
  awaiting_payments: {
    label: 'Awaiting payments',
    className: 'text-muted-foreground',
  },
  paid: { label: 'Paid', className: 'text-primary' },
  settled: { label: 'Settled', className: 'text-green-500' },
};

const statusLabels: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'outline' }
> = {
  draft: { label: 'Draft', variant: 'outline' },
  uploaded: { label: 'Processing', variant: 'secondary' },
  parsed: { label: 'Review needed', variant: 'default' },
  verified: { label: 'Done', variant: 'secondary' },
  locked: { label: 'Done', variant: 'secondary' },
};

interface BillCardProps {
  bill: Bill;
  total?: BillTotal | null;
  isOwner?: boolean;
  isArchived?: boolean;
  contextualStatus?: string;
  memberCount?: number;
}

export function BillCard({
  bill,
  total,
  isOwner = true,
  isArchived,
  contextualStatus,
  memberCount,
}: BillCardProps) {
  const status = statusLabels[bill.status] ?? statusLabels.draft;
  const href =
    bill.status === 'draft'
      ? `/bills/${bill.id}/upload`
      : bill.status === 'parsed'
        ? `/bills/${bill.id}/verify`
        : `/bills/${bill.id}`;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center p-0">
        <Link
          href={href}
          className="flex-1 min-w-0 flex items-center gap-3 p-4"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{bill.name}</p>
              {bill.status !== 'verified' && bill.status !== 'locked' && (
                <Badge variant={status.variant} className="shrink-0">
                  {status.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(bill.created_at)}
              {contextualStatus && contextualStatusConfig[contextualStatus] && (
                <span
                  className={cn(
                    'before:content-[\'·\'] before:mx-1',
                    contextualStatusConfig[contextualStatus].className
                  )}
                >
                  {contextualStatusConfig[contextualStatus].label}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(bill.status === 'verified' || bill.status === 'locked') &&
              memberCount != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {memberCount}
                </span>
              )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
        <div className="pr-2 shrink-0 flex items-center">
          <div className="flex items-center">
            <ArchiveBillButton
              billId={bill.id}
              isArchived={isArchived ?? false}
            />
            {isOwner && (
              <DeleteBillButton billId={bill.id} billName={bill.name} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
