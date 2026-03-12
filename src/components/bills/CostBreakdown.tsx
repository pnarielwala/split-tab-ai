'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import type { ParticipantShare } from "@/types/database";

interface CostBreakdownProps {
  shares: ParticipantShare[];
  currency: string;
  currentUserId: string;
  paidUserIds?: string[];
  payerId?: string;
  onTogglePaid?: (userId: string, isPaid: boolean) => Promise<void>;
}

export function CostBreakdown({
  shares,
  currency,
  currentUserId,
  paidUserIds = [],
  payerId,
  onTogglePaid,
}: CostBreakdownProps) {
  const [toggling, setToggling] = useState<string | null>(null);

  if (shares.length === 0) return null;

  const sorted = [...shares].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return b.total - a.total;
  });

  async function handleToggle(userId: string, isPaid: boolean) {
    if (!onTogglePaid) return;
    setToggling(userId);
    try {
      await onTogglePaid(userId, isPaid);
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Each person&apos;s share of the bill based on what they claimed, with tax and fees prorated proportionally.
      </p>
      <div className="space-y-3">
        {sorted.map((share) => {
          const isMe = share.userId === currentUserId;
          const isPayer = share.userId === payerId;
          const isPaid = paidUserIds.includes(share.userId);
          const canToggle = !!onTogglePaid && !isPayer;

          return (
            <Card
              key={share.userId}
              className={isMe ? "border-primary ring-1 ring-primary" : ""}
            >
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate">
                      {share.displayName}
                      {isMe && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                      {isPayer && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (payer)
                        </span>
                      )}
                    </span>
                    {!isPayer && (
                      isPaid ? (
                        <Badge variant="secondary" className="text-xs h-5 shrink-0 text-green-600 bg-green-50">
                          Paid
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs h-5 shrink-0 text-muted-foreground">
                          Unpaid
                        </Badge>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canToggle && (
                      <button
                        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                        disabled={toggling === share.userId}
                        onClick={() => handleToggle(share.userId, isPaid)}
                      >
                        {toggling === share.userId
                          ? '…'
                          : isPaid
                          ? 'Unmark'
                          : 'Mark paid'}
                      </button>
                    )}
                    <span className="text-base font-bold">
                      {formatCurrency(share.total, currency)}
                    </span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Items</span>
                  <span>{formatCurrency(share.subtotal, currency)}</span>
                </div>
                {share.tax > 0 && (
                  <div className="flex justify-between">
                    <span>Tax (prorated)</span>
                    <span>{formatCurrency(share.tax, currency)}</span>
                  </div>
                )}
                {share.gratuity > 0 && (
                  <div className="flex justify-between">
                    <span>Gratuity (prorated)</span>
                    <span>{formatCurrency(share.gratuity, currency)}</span>
                  </div>
                )}
                {share.fees > 0 && (
                  <div className="flex justify-between">
                    <span>Fees (prorated)</span>
                    <span>{formatCurrency(share.fees, currency)}</span>
                  </div>
                )}
                {share.discounts > 0 && (
                  <div className="flex justify-between">
                    <span>Discounts (prorated)</span>
                    <span>−{formatCurrency(share.discounts, currency)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatCurrency(share.total, currency)}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
