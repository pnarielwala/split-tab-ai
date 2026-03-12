'use client';

import { useMemo, useOptimistic, startTransition, useState, useTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PieChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { claimItem, unclaimItem, markAsPaid, markAsUnpaid } from '@/app/actions/bills';
import { getSplitPageData } from '@/app/actions/queries';
import { ShareButton } from './ShareButton';
import { ViewReceiptButton } from './ViewReceiptButton';
import { RequestPaymentButton } from './RequestPaymentButton';
import { ChangePayerButton } from './ChangePayerButton';
import type { LineItemWithClaims } from '@/types/database';

interface BillDetailProps {
  billId: string;
  currentUserId: string;
  isOwner: boolean;
  shareUrl: string;
  receiptUrl: string | null;
  billName: string;
}

export function BillDetail({
  billId,
  currentUserId,
  isOwner,
  shareUrl,
  receiptUrl,
  billName,
}: BillDetailProps) {
  const queryClient = useQueryClient();
  const [youOweOpen, setYouOweOpen] = useState(false);
  const [isPaidPending, startPaidTransition] = useTransition();

  const { data, isLoading } = useQuery({
    queryKey: ['split', billId],
    queryFn: () => getSplitPageData(billId),
  });

  const serverItems = data?.lineItems ?? [];
  const totals = data?.totals ?? null;
  const members = data?.members ?? [];
  const ownerProfile = data?.ownerProfile;
  const payerProfile = data?.payerProfile;
  const payerPaymentMethods = data?.payerPaymentMethods ?? null;
  const paidUserIds = data?.paidUserIds ?? [];
  const isPayer = currentUserId === payerProfile?.id;
  const isCurrentUserPaid = paidUserIds.includes(currentUserId);
  const currency = totals?.currency ?? 'USD';

  const participantMap = useMemo(() => {
    const map = new Map<string, string>();
    if (ownerProfile) map.set(ownerProfile.id, ownerProfile.display_name);
    for (const m of members) {
      map.set(m.user_id, m.profiles.display_name);
    }
    return map;
  }, [ownerProfile, members]);

  const myName = participantMap.get(currentUserId) ?? 'You';

  const [optimisticItems, addOptimistic] = useOptimistic(
    serverItems,
    (
      state: LineItemWithClaims[],
      update: { itemId: string; action: 'claim' | 'unclaim' }
    ) =>
      state.map((item) =>
        item.id !== update.itemId
          ? item
          : {
              ...item,
              bill_item_claims:
                update.action === 'claim'
                  ? [
                      ...item.bill_item_claims,
                      {
                        id: '',
                        item_id: update.itemId,
                        user_id: currentUserId,
                        claimed_at: '',
                        profiles: {
                          id: currentUserId,
                          display_name: myName,
                          email: null,
                        },
                      },
                    ]
                  : item.bill_item_claims.filter(
                      (c) => c.user_id !== currentUserId
                    ),
            }
      )
  );

  function isClaimed(item: LineItemWithClaims) {
    return item.bill_item_claims.some((c) => c.user_id === currentUserId);
  }

  function handleToggle(item: LineItemWithClaims) {
    if (isCurrentUserPaid) return;
    const claimed = isClaimed(item);
    startTransition(async () => {
      addOptimistic({ itemId: item.id, action: claimed ? 'unclaim' : 'claim' });
      if (claimed) {
        await unclaimItem(item.id, billId);
      } else {
        await claimItem(item.id, billId);
      }
      queryClient.invalidateQueries({ queryKey: ['split', billId] });
      queryClient.invalidateQueries({ queryKey: ['bill', billId] });
    });
  }

  const myShare = useMemo(() => {
    const billSubtotal = totals?.subtotal ?? 0;
    const billTax = totals?.tax ?? 0;
    const billGratuity = totals?.gratuity ?? 0;
    const billFees = totals?.fees ?? 0;
    const billDiscounts = totals?.discounts ?? 0;

    let subtotal = 0;
    for (const item of optimisticItems) {
      const claimed = item.bill_item_claims.some(
        (c) => c.user_id === currentUserId
      );
      if (!claimed) continue;
      const splitCount = item.bill_item_claims.length;
      subtotal += item.total_price / splitCount;
    }

    const ratio = billSubtotal > 0 ? subtotal / billSubtotal : 0;
    const tax = billTax * ratio;
    const gratuity = billGratuity * ratio;
    const fees = billFees * ratio;
    const discounts = billDiscounts * ratio;
    return {
      subtotal,
      tax,
      gratuity,
      fees,
      discounts,
      total: subtotal + tax + gratuity + fees - discounts,
    };
  }, [optimisticItems, totals, currentUserId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-3 border-b last:border-b-0"
            >
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-14 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const payerName = payerProfile?.display_name ?? 'Payer';

  return (
    <div className="space-y-6">
      {/* Action buttons row */}
      <div className="flex flex-wrap gap-2">
        <ShareButton shareUrl={shareUrl} billName={billName} />
        {receiptUrl && <ViewReceiptButton receiptUrl={receiptUrl} />}
        <Button variant="outline" size="sm" asChild className="flex-1">
          <Link href={`/bills/${billId}/breakdown`} className="gap-1.5">
            <PieChart className="h-4 w-4" />
            Split summary
          </Link>
        </Button>

        <div className="flex gap-2 w-full">
          {isOwner && members.length > 0 && ownerProfile && (
            <div className="flex-1">
              <ChangePayerButton
                billId={billId}
                currentPayerId={payerProfile?.id ?? ownerProfile.id}
                participants={[
                  {
                    userId: ownerProfile.id,
                    displayName: ownerProfile.display_name,
                  },
                  ...members.map((m) => ({
                    userId: m.user_id,
                    displayName: m.profiles.display_name,
                  })),
                ]}
                onSuccess={() => {
                  queryClient.invalidateQueries({
                    queryKey: ['split', billId],
                  });
                }}
              />
            </div>
          )}
          <div className="flex-auto">
            {!isPayer && (
              <Button
                className="w-full"
                variant={isCurrentUserPaid ? 'outline' : myShare.total > 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYouOweOpen(true)}
              >
                {isCurrentUserPaid
                  ? "You're settled up!"
                  : `You owe ${formatCurrency(myShare.total, currency)}`}
              </Button>
            )}
            {isPayer && (
              <RequestPaymentButton
                billId={billId}
                billName={billName}
                shareUrl={shareUrl}
                currency={currency}
                members={[
                  ...(ownerProfile && ownerProfile.id !== payerProfile?.id
                    ? [{ userId: ownerProfile.id, displayName: ownerProfile.display_name, isPaid: paidUserIds.includes(ownerProfile.id), amount: data?.shares.find((s) => s.userId === ownerProfile.id)?.total }]
                    : []),
                  ...members.map((m) => ({
                    userId: m.user_id,
                    displayName: m.profiles.display_name,
                    isPaid: paidUserIds.includes(m.user_id),
                    amount: data?.shares.find((s) => s.userId === m.user_id)?.total,
                  })),
                ]}
                onTogglePaid={async (userId, isPaid) => {
                  if (isPaid) {
                    await markAsUnpaid(billId, userId);
                  } else {
                    await markAsPaid(billId, userId);
                  }
                  queryClient.invalidateQueries({ queryKey: ['split', billId] });
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Item list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {isCurrentUserPaid ? 'Your claimed items' : 'Tap to claim items'}
        </h2>
        <div className="space-y-0">
          {optimisticItems.map((item) => {
            const claimed = isClaimed(item);
            return (
              <button
                key={item.id}
                onClick={() => handleToggle(item)}
                disabled={isCurrentUserPaid}
                className="w-full text-left border-b last:border-b-0 py-3 flex items-center gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors disabled:pointer-events-none disabled:opacity-75"
              >
                {!isCurrentUserPaid && (
                  <span
                    className={`shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      claimed
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/40'
                    }`}
                  >
                    {claimed && (
                      <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                    )}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-sm text-muted-foreground shrink-0 w-5 text-center">
                        {item.quantity}
                      </span>
                      <p className="text-sm font-medium truncate">
                        {item.name}
                      </p>
                      {item.quantity > 1 && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          × {formatCurrency(item.unit_price, currency)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium shrink-0">
                      {formatCurrency(item.total_price, currency)}
                    </p>
                  </div>
                  {item.bill_item_claims.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {item.bill_item_claims.map((claim) => (
                        <Badge
                          key={claim.user_id}
                          variant={
                            claim.user_id === currentUserId
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-xs h-5"
                        >
                          {participantMap.get(claim.user_id) ??
                            claim.profiles.display_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bill totals */}
      {totals && (
        <div className="space-y-2 text-sm">
          {totals.subtotal != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal, currency)}</span>
            </div>
          )}
          {totals.tax != null && totals.tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatCurrency(totals.tax, currency)}</span>
            </div>
          )}
          {totals.gratuity != null && totals.gratuity > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Gratuity</span>
              <span>{formatCurrency(totals.gratuity, currency)}</span>
            </div>
          )}
          {totals.fees != null && totals.fees > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Fees</span>
              <span>{formatCurrency(totals.fees, currency)}</span>
            </div>
          )}
          {totals.discounts != null && totals.discounts > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discounts</span>
              <span>−{formatCurrency(totals.discounts, currency)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-semibold text-base">
            <span>Total</span>
            <span>{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>
      )}

      {/* You Owe Modal */}
      {!isPayer && (
        <Dialog open={youOweOpen} onOpenChange={setYouOweOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>You owe {payerName}</DialogTitle>
              <DialogDescription>
                {formatCurrency(myShare.total, currency)} for {billName}
              </DialogDescription>
            </DialogHeader>
            <Card>
              <CardContent className="px-4 py-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Items</span>
                  <span>{formatCurrency(myShare.subtotal, currency)}</span>
                </div>
                {myShare.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax (prorated)</span>
                    <span>{formatCurrency(myShare.tax, currency)}</span>
                  </div>
                )}
                {myShare.gratuity > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Gratuity (prorated)</span>
                    <span>{formatCurrency(myShare.gratuity, currency)}</span>
                  </div>
                )}
                {myShare.fees > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Fees (prorated)</span>
                    <span>{formatCurrency(myShare.fees, currency)}</span>
                  </div>
                )}
                {myShare.discounts > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discounts (prorated)</span>
                    <span>−{formatCurrency(myShare.discounts, currency)}</span>
                  </div>
                )}
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-foreground">
                  <span>Your total</span>
                  <span>{formatCurrency(myShare.total, currency)}</span>
                </div>
              </CardContent>
            </Card>

            {payerPaymentMethods &&
            (payerPaymentMethods.venmo_handle ||
              payerPaymentMethods.zelle_id ||
              payerPaymentMethods.cashapp_handle ||
              payerPaymentMethods.paypal_id) ? (
              <div className="space-y-2">
                {payerPaymentMethods.venmo_handle &&
                  (() => {
                    const handle = payerPaymentMethods.venmo_handle.replace(
                      /^@/,
                      ''
                    );
                    const venmoParams = new URLSearchParams({
                      txn: 'pay',
                      amount: myShare.total.toFixed(2),
                      note: billName,
                    });
                    return (
                      <a
                        href={`https://venmo.com/${handle}?${venmoParams}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">Venmo</span>
                        <span className="text-muted-foreground">@{handle}</span>
                      </a>
                    );
                  })()}
                {payerPaymentMethods.cashapp_handle &&
                  (() => {
                    const handle = payerPaymentMethods.cashapp_handle.replace(
                      /^\$/,
                      ''
                    );
                    const amount = myShare.total.toFixed(2);
                    return (
                      <a
                        href={`https://cash.app/$${handle}/${amount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">Cash App</span>
                        <span className="text-muted-foreground">${handle}</span>
                      </a>
                    );
                  })()}
                {payerPaymentMethods.zelle_id && (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="font-medium">Zelle</span>
                    <span className="text-muted-foreground">
                      {payerPaymentMethods.zelle_id}
                    </span>
                  </div>
                )}
                {payerPaymentMethods.paypal_id &&
                  (() => {
                    const id = payerPaymentMethods.paypal_id!;
                    const isEmail = id.includes('@') && !id.startsWith('@');
                    const handle = id.replace(/^@/, '');
                    const amount = myShare.total.toFixed(2);
                    return isEmail ? (
                      <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span className="font-medium">PayPal</span>
                        <span className="text-muted-foreground">{id}</span>
                      </div>
                    ) : (
                      <a
                        href={`https://paypal.me/${handle}/${amount}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <span className="font-medium">PayPal</span>
                        <span className="text-muted-foreground">{id}</span>
                      </a>
                    );
                  })()}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {payerName} hasn&apos;t added payment methods yet.
              </p>
            )}
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              {isCurrentUserPaid ? (
                <>
                  <span className="text-sm text-green-600 font-medium">Settled up ✓</span>
                  <button
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                    disabled={isPaidPending}
                    onClick={() => {
                      startPaidTransition(async () => {
                        await markAsUnpaid(billId, currentUserId);
                        queryClient.invalidateQueries({ queryKey: ['split', billId] });
                      });
                    }}
                  >
                    Unmark
                  </button>
                </>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  disabled={isPaidPending}
                  onClick={() => {
                    startPaidTransition(async () => {
                      await markAsPaid(billId);
                      queryClient.invalidateQueries({ queryKey: ['split', billId] });
                      setYouOweOpen(false);
                    });
                  }}
                >
                  {isPaidPending ? 'Saving…' : 'Mark as paid'}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
