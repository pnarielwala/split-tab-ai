'use client';

import {
  useMemo,
  useOptimistic,
  startTransition,
  useState,
  useTransition,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PieChart, Lock } from 'lucide-react';
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
import {
  claimItem,
  unclaimItem,
  setClaimedQuantity,
  markAsPaid,
  markAsUnpaid,
  markMemberDone,
  lockBill,
  unlockBill,
} from '@/app/actions/bills';
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
  const [doneConfirmOpen, setDoneConfirmOpen] = useState(false);
  const [isPaidPending, startPaidTransition] = useTransition();
  const [isDonePending, startDoneTransition] = useTransition();
  const [isLockPending, startLockTransition] = useTransition();
  const [isUnlockPending, startUnlockTransition] = useTransition();
  const [lockError, setLockError] = useState<
    { name: string; unclaimed: number }[] | null
  >(null);

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
  const isLocked = data?.isLocked ?? false;
  const memberDoneStatuses = data?.memberDoneStatuses ?? [];
  const currentMemberIsDone = isOwner
    ? false
    : (memberDoneStatuses.find((m) => m.userId === currentUserId)?.isDone ??
      false);
  const allMembersDone = memberDoneStatuses.every((m) => m.isDone);

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
      update: {
        itemId: string;
        action: 'claim' | 'unclaim' | 'set_quantity';
        quantity?: number;
      }
    ) =>
      state.map((item) => {
        if (item.id !== update.itemId) return item;
        if (update.action === 'claim') {
          return {
            ...item,
            bill_item_claims: [
              ...item.bill_item_claims,
              {
                id: '',
                item_id: update.itemId,
                user_id: currentUserId,
                claimed_at: '',
                quantity_claimed: 1,
                profiles: {
                  id: currentUserId,
                  display_name: myName,
                  email: null,
                },
              },
            ],
          };
        }
        if (update.action === 'unclaim') {
          return {
            ...item,
            bill_item_claims: item.bill_item_claims.filter(
              (c) => c.user_id !== currentUserId
            ),
          };
        }
        // set_quantity
        const qty = update.quantity ?? 0;
        if (qty <= 0) {
          return {
            ...item,
            bill_item_claims: item.bill_item_claims.filter(
              (c) => c.user_id !== currentUserId
            ),
          };
        }
        const existing = item.bill_item_claims.find(
          (c) => c.user_id === currentUserId
        );
        if (existing) {
          return {
            ...item,
            bill_item_claims: item.bill_item_claims.map((c) =>
              c.user_id === currentUserId ? { ...c, quantity_claimed: qty } : c
            ),
          };
        }
        return {
          ...item,
          bill_item_claims: [
            ...item.bill_item_claims,
            {
              id: '',
              item_id: update.itemId,
              user_id: currentUserId,
              claimed_at: '',
              quantity_claimed: qty,
              profiles: {
                id: currentUserId,
                display_name: myName,
                email: null,
              },
            },
          ],
        };
      })
  );

  function isClaimed(item: LineItemWithClaims) {
    return item.bill_item_claims.some((c) => c.user_id === currentUserId);
  }

  function handleToggle(item: LineItemWithClaims) {
    if (isCurrentUserPaid || isLocked || currentMemberIsDone) return;
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
      const myClaim = item.bill_item_claims.find(
        (c) => c.user_id === currentUserId
      );
      if (!myClaim) continue;
      const share =
        item.quantity > 1
          ? (myClaim.quantity_claimed / item.quantity) * item.total_price
          : item.total_price / item.bill_item_claims.length;
      subtotal += share;
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
      {/* Locked banner */}
      {isLocked && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            Bill is locked — no further changes
          </div>
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={isUnlockPending}
              onClick={() =>
                startUnlockTransition(async () => {
                  await unlockBill(billId);
                  queryClient.invalidateQueries({
                    queryKey: ['split', billId],
                  });
                })
              }
            >
              {isUnlockPending ? '…' : 'Unlock'}
            </Button>
          )}
        </div>
      )}

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
            {!isPayer && isLocked && (
              <Button
                className="w-full"
                variant={
                  isCurrentUserPaid
                    ? 'outline'
                    : myShare.total > 0
                      ? 'default'
                      : 'outline'
                }
                size="sm"
                onClick={() => setYouOweOpen(true)}
              >
                {isCurrentUserPaid
                  ? "You're settled up!"
                  : `You owe ${formatCurrency(myShare.total, currency)}`}
              </Button>
            )}
            {!isPayer && !isLocked && (
              <Button
                className="w-full"
                variant={myShare.total > 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYouOweOpen(true)}
              >
                {`You owe ${formatCurrency(myShare.total, currency)}`}
              </Button>
            )}
            {isPayer && isLocked && (
              <RequestPaymentButton
                billId={billId}
                billName={billName}
                shareUrl={shareUrl}
                currency={currency}
                members={[
                  ...(ownerProfile && ownerProfile.id !== payerProfile?.id
                    ? [
                        {
                          userId: ownerProfile.id,
                          displayName: ownerProfile.display_name,
                          isPaid: paidUserIds.includes(ownerProfile.id),
                          amount: data?.shares.find(
                            (s) => s.userId === ownerProfile.id
                          )?.total,
                        },
                      ]
                    : []),
                  ...members.map((m) => ({
                    userId: m.user_id,
                    displayName: m.profiles.display_name,
                    isPaid: paidUserIds.includes(m.user_id),
                    amount: data?.shares.find((s) => s.userId === m.user_id)
                      ?.total,
                  })),
                ]}
                onTogglePaid={async (userId, isPaid) => {
                  if (isPaid) {
                    await markAsUnpaid(billId, userId);
                  } else {
                    await markAsPaid(billId, userId);
                  }
                  queryClient.invalidateQueries({
                    queryKey: ['split', billId],
                  });
                }}
              />
            )}
            {isPayer && !isLocked && (
              <Button variant="outline" size="sm" className="w-full" disabled>
                Request payment (lock bill first)
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Done claiming card — non-owners only, pre-lock */}
      {!isOwner && !isLocked && (
        <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
          <div className="text-sm">
            <p className="font-medium">
              {currentMemberIsDone ? "You're done claiming" : 'Done selecting?'}
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {currentMemberIsDone
                ? 'Tap to undo and make changes'
                : "Let the owner know you're ready"}
            </p>
          </div>
          <Button
            size="sm"
            variant={currentMemberIsDone ? 'outline' : 'default'}
            disabled={isDonePending}
            onClick={() => {
              if (currentMemberIsDone) {
                startDoneTransition(async () => {
                  await markMemberDone(billId, false);
                  queryClient.invalidateQueries({
                    queryKey: ['split', billId],
                  });
                });
              } else {
                setDoneConfirmOpen(true);
              }
            }}
          >
            {isDonePending ? '…' : currentMemberIsDone ? 'Undo' : "I'm done"}
          </Button>
        </div>
      )}

      {/* Member status indicators — owner only, pre-lock */}
      {isOwner && !isLocked && memberDoneStatuses.length > 0 && (
        <div className="space-y-1 rounded-lg border p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Member status
          </p>
          {memberDoneStatuses.map(({ userId, isDone }) => (
            <div
              key={userId}
              className="flex items-center justify-between text-sm"
            >
              <span>{participantMap.get(userId) ?? userId}</span>
              {isDone ? (
                <span className="text-green-600 text-xs font-medium">
                  Done ✓
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">
                  Still claiming…
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lock bill section — owner only, pre-lock */}
      {isOwner && !isLocked && (
        <div className="space-y-2">
          <Button
            variant="default"
            size="sm"
            className="w-full"
            disabled={
              isLockPending ||
              (memberDoneStatuses.length > 0 && !allMembersDone)
            }
            onClick={() => {
              setLockError(null);
              startLockTransition(async () => {
                const result = await lockBill(billId);
                if ('error' in result) {
                  if (
                    result.error === 'unclaimed_items' &&
                    result.unclaimedItems
                  ) {
                    setLockError(result.unclaimedItems);
                  }
                } else {
                  queryClient.invalidateQueries({
                    queryKey: ['split', billId],
                  });
                }
              });
            }}
          >
            {isLockPending ? 'Locking…' : 'Lock bill'}
          </Button>
          {memberDoneStatuses.length > 0 && !allMembersDone && (
            <p className="text-xs text-muted-foreground text-center">
              Waiting for all members to mark done
            </p>
          )}
          {lockError && (
            <div className="rounded-md border border-destructive/40 dark:border-red-400/40 bg-destructive/5 dark:bg-red-400/10 p-3 text-sm text-red-700 dark:text-red-300">
              <p className="font-medium mb-1">
                Some items aren&apos;t fully claimed:
              </p>
              <ul className="list-disc list-inside space-y-0.5">
                {lockError.map((n) => (
                  <li key={n.name}>
                    <span className="pl-2 pr-3">{n.unclaimed}</span>
                    <span>{n.name}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">
                All items must be claimed before locking.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Item list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {isLocked
            ? 'Claimed items (bill locked)'
            : isCurrentUserPaid || currentMemberIsDone
              ? 'Your claimed items'
              : 'Tap to claim items'}
        </h2>
        <div className="space-y-0">
          {optimisticItems.map((item) => {
            const myClaim = item.bill_item_claims.find(
              (c) => c.user_id === currentUserId
            );
            const claimed = !!myClaim;
            const myQty = myClaim?.quantity_claimed ?? 0;

            if (item.quantity > 1) {
              const othersClaimed = item.bill_item_claims
                .filter((c) => c.user_id !== currentUserId)
                .reduce((sum, c) => sum + c.quantity_claimed, 0);
              const maxClaimable = item.quantity - othersClaimed;
              const readOnly =
                isCurrentUserPaid || isLocked || currentMemberIsDone;
              // Stepper UI for multi-unit items
              return (
                <div
                  key={item.id}
                  className={`w-full border-b last:border-b-0 py-3 flex items-center gap-3${readOnly ? ' opacity-75' : ''}`}
                >
                  {/* Stepper — hidden when read-only */}
                  {!readOnly && (
                    <div className="shrink-0 flex flex-col items-center gap-1">
                      <button
                        onClick={() => {
                          const next = myQty + 1;
                          startTransition(async () => {
                            addOptimistic({
                              itemId: item.id,
                              action: 'set_quantity',
                              quantity: next,
                            });
                            await setClaimedQuantity(item.id, billId, next);
                            queryClient.invalidateQueries({
                              queryKey: ['split', billId],
                            });
                            queryClient.invalidateQueries({
                              queryKey: ['bill', billId],
                            });
                          });
                        }}
                        disabled={myQty >= maxClaimable}
                        className="h-6 w-6 rounded-full border flex items-center justify-center text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        aria-label="Increase"
                      >
                        +
                      </button>
                      <span className="w-5 text-center text-sm font-medium tabular-nums">
                        {myQty}
                      </span>
                      <button
                        onClick={() => {
                          const next = myQty - 1;
                          startTransition(async () => {
                            addOptimistic({
                              itemId: item.id,
                              action: 'set_quantity',
                              quantity: next,
                            });
                            await setClaimedQuantity(item.id, billId, next);
                            queryClient.invalidateQueries({
                              queryKey: ['split', billId],
                            });
                            queryClient.invalidateQueries({
                              queryKey: ['bill', billId],
                            });
                          });
                        }}
                        disabled={myQty <= 0}
                        className="h-6 w-6 rounded-full border flex items-center justify-center text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:pointer-events-none"
                        aria-label="Decrease"
                      >
                        −
                      </button>
                    </div>
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
                        <span className="text-xs text-muted-foreground shrink-0">
                          × {formatCurrency(item.unit_price, currency)}
                        </span>
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
                            className={`text-xs h-5${readOnly ? ' pointer-events-none' : ''}`}
                          >
                            {participantMap.get(claim.user_id) ??
                              claim.profiles.display_name}
                            : {claim.quantity_claimed}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // quantity === 1: existing toggle behavior
            return (
              <button
                key={item.id}
                onClick={() => handleToggle(item)}
                disabled={isCurrentUserPaid || isLocked || currentMemberIsDone}
                className="w-full text-left border-b last:border-b-0 py-3 flex items-center gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors disabled:pointer-events-none disabled:opacity-75"
              >
                {!isCurrentUserPaid && !isLocked && !currentMemberIsDone && (
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

      {/* Done Confirmation Modal */}
      {!isOwner && (
        <Dialog open={doneConfirmOpen} onOpenChange={setDoneConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Review your selections</DialogTitle>
              <DialogDescription>
                Make sure everything looks right before confirming.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-hidden">
              {(() => {
                const claimed = optimisticItems.filter((item) =>
                  item.bill_item_claims.some((c) => c.user_id === currentUserId)
                );
                const unclaimed = optimisticItems.filter(
                  (item) =>
                    !item.bill_item_claims.some(
                      (c) => c.user_id === currentUserId
                    )
                );
                return (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Your items ({claimed.reduce((sum, item) => {
                          const qty = item.bill_item_claims.find((c) => c.user_id === currentUserId)?.quantity_claimed ?? 1;
                          return sum + qty;
                        }, 0)})
                      </p>
                      {claimed.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          None — you haven&apos;t claimed anything.
                        </p>
                      ) : (
                        <div className="space-y-0">
                          {claimed.map((item) => {
                            const myClaim = item.bill_item_claims.find(
                              (c) => c.user_id === currentUserId
                            );
                            const myQty = myClaim?.quantity_claimed ?? 1;
                            const myPrice =
                              item.quantity > 1
                                ? (myQty / item.quantity) * item.total_price
                                : item.total_price /
                                  item.bill_item_claims.length;
                            return (
                              <div
                                key={item.id}
                                className="flex items-baseline justify-between gap-2 py-1.5 border-b last:border-b-0 text-sm overflow-hidden"
                              >
                                <div className="flex items-baseline gap-1 min-w-0 flex-1 overflow-hidden">
                                  <p className="font-medium truncate">
                                    {item.name}
                                  </p>
                                  {item.quantity > 1 && (
                                    <span className="shrink-0 text-muted-foreground">
                                      ×{myQty}
                                    </span>
                                  )}
                                </div>
                                <span className="shrink-0 text-muted-foreground">
                                  {formatCurrency(myPrice, currency)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {unclaimed.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Not claimed ({unclaimed.length})
                        </p>
                        <div className="space-y-0">
                          {unclaimed.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-baseline justify-between gap-2 py-1.5 border-b last:border-b-0 text-sm text-muted-foreground overflow-hidden"
                            >
                              <p className="truncate min-w-0 flex-1">
                                {item.name}
                              </p>
                              <span className="shrink-0">
                                {formatCurrency(item.total_price, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setDoneConfirmOpen(false)}
              >
                Go back
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={isDonePending}
                onClick={() => {
                  setDoneConfirmOpen(false);
                  startDoneTransition(async () => {
                    await markMemberDone(billId, true);
                    queryClient.invalidateQueries({
                      queryKey: ['split', billId],
                    });
                  });
                }}
              >
                {isDonePending ? '…' : 'Looks good'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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

            {!isLocked && (
              <p className="text-sm text-muted-foreground flex flex-col gap-2">
                <span>
                  Payment options will be available once the bill is locked.
                </span>
                <span>
                  Once the bill is locked, payer may send an email or SMS
                  containing those payment methods (Venmo, Cash App, etc.)
                </span>
              </p>
            )}
            {isLocked &&
              (payerPaymentMethods &&
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
                          <span className="text-muted-foreground">
                            @{handle}
                          </span>
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
                          <span className="text-muted-foreground">
                            ${handle}
                          </span>
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
              ))}
            {isLocked && (
              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                {isCurrentUserPaid ? (
                  <>
                    <span className="text-sm text-green-600 font-medium">
                      Settled up ✓
                    </span>
                    <button
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50"
                      disabled={isPaidPending}
                      onClick={() => {
                        startPaidTransition(async () => {
                          await markAsUnpaid(billId, currentUserId);
                          queryClient.invalidateQueries({
                            queryKey: ['split', billId],
                          });
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
                        queryClient.invalidateQueries({
                          queryKey: ['split', billId],
                        });
                        setYouOweOpen(false);
                      });
                    }}
                  >
                    {isPaidPending ? 'Saving…' : 'Mark as paid'}
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
