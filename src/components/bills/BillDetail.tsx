'use client';

import {
  useMemo,
  useOptimistic,
  startTransition,
  useState,
  useTransition,
  Suspense,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { PieChart, Lock, CheckCircle2, Merge, ChevronDown, X } from 'lucide-react';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
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
  updateLineItem,
  addGuest,
  removeGuest,
} from '@/app/actions/bills';
import { getSplitPageData } from '@/app/actions/queries';
import { ShareButton } from './ShareButton';
import { ViewReceiptButton } from './ViewReceiptButton';
import { RequestPaymentButton } from './RequestPaymentButton';
import { ChangePayerButton } from './ChangePayerButton';
import { MarkAsPaidModal } from './MarkAsPaidModal';
import type { BillGuest, LineItemWithClaims } from '@/types/database';


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
  const [mergeItem, setMergeItem] = useState<LineItemWithClaims | null>(null);
  const [mergeName, setMergeName] = useState('');
  const [merging, setMerging] = useState(false);

  // "Claiming for" switcher state
  type ClaimingAs = { type: 'self' } | { type: 'guest'; guestId: string; name: string };
  const [claimingAs, setClaimingAs] = useState<ClaimingAs>({ type: 'self' });
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [addingGuest, setAddingGuest] = useState(false);
  const [deleteGuestConfirm, setDeleteGuestConfirm] = useState<{ guestId: string; name: string } | null>(null);

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
  const guests = data?.guests ?? [];
  const currentMemberIsDone = isOwner
    ? false
    : (memberDoneStatuses.find((m) => m.userId === currentUserId)?.isDone ??
      false);
  const allMembersDone = memberDoneStatuses.every((m) => m.isDone);

  const nonPayerParticipantIds = [
    ...(ownerProfile && ownerProfile.id !== payerProfile?.id
      ? [ownerProfile.id]
      : []),
    ...members
      .filter((m) => m.user_id !== payerProfile?.id)
      .map((m) => m.user_id),
  ];
  const allSettled =
    nonPayerParticipantIds.length > 0 &&
    nonPayerParticipantIds.every((id) => paidUserIds.includes(id));

  const participantMap = useMemo(() => {
    const map = new Map<string, string>();
    if (ownerProfile) map.set(ownerProfile.id, ownerProfile.display_name);
    for (const m of members) {
      map.set(m.user_id, m.profiles.display_name);
    }
    return map;
  }, [ownerProfile, members]);

  const myName = participantMap.get(currentUserId) ?? 'You';

  // Build guestId → name map for badge display
  const guestNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of guests) map.set(g.id, g.name);
    return map;
  }, [guests]);

  function claimDisplayName(claim: { user_id: string | null; guest_id: string | null; profiles: { display_name: string } | null; bill_guests: { name: string } | null }): string {
    if (claim.guest_id) return guestNameMap.get(claim.guest_id) ?? claim.bill_guests?.name ?? 'Guest';
    if (claim.user_id) return participantMap.get(claim.user_id) ?? claim.profiles?.display_name ?? 'Unknown';
    return 'Unknown';
  }

  function isActiveClaimerClaim(claim: { user_id: string | null; guest_id: string | null }): boolean {
    if (claimingAs.type === 'guest') return claim.guest_id === claimingAs.guestId;
    return claim.user_id === currentUserId;
  }

  const [optimisticItems, addOptimistic] = useOptimistic(
    serverItems,
    (
      state: LineItemWithClaims[],
      update: {
        itemId: string;
        action: 'claim' | 'unclaim' | 'set_quantity';
        quantity?: number;
        guestId?: string;
        guestName?: string;
      }
    ) =>
      state.map((item) => {
        if (item.id !== update.itemId) return item;
        const { guestId, guestName } = update;
        if (update.action === 'claim') {
          if (guestId) {
            return {
              ...item,
              bill_item_claims: [
                ...item.bill_item_claims.filter((c) => c.guest_id !== guestId),
                {
                  id: '',
                  item_id: update.itemId,
                  user_id: null,
                  guest_id: guestId,
                  claimed_at: '',
                  quantity_claimed: 1,
                  profiles: null,
                  bill_guests: { id: guestId, name: guestName ?? '', bill_id: billId, sponsored_by: currentUserId, created_at: '' },
                },
              ],
            };
          }
          return {
            ...item,
            bill_item_claims: [
              ...item.bill_item_claims.filter((c) => c.user_id !== currentUserId),
              {
                id: '',
                item_id: update.itemId,
                user_id: currentUserId,
                guest_id: null,
                claimed_at: '',
                quantity_claimed: 1,
                profiles: { id: currentUserId, display_name: myName, email: null },
                bill_guests: null,
              },
            ],
          };
        }
        if (update.action === 'unclaim') {
          if (guestId) {
            return {
              ...item,
              bill_item_claims: item.bill_item_claims.filter((c) => c.guest_id !== guestId),
            };
          }
          return {
            ...item,
            bill_item_claims: item.bill_item_claims.filter((c) => c.user_id !== currentUserId),
          };
        }
        // set_quantity
        const qty = update.quantity ?? 0;
        if (guestId) {
          if (qty <= 0) {
            return {
              ...item,
              bill_item_claims: item.bill_item_claims.filter((c) => c.guest_id !== guestId),
            };
          }
          const existing = item.bill_item_claims.find((c) => c.guest_id === guestId);
          if (existing) {
            return {
              ...item,
              bill_item_claims: item.bill_item_claims.map((c) =>
                c.guest_id === guestId ? { ...c, quantity_claimed: qty } : c
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
                user_id: null,
                guest_id: guestId,
                claimed_at: '',
                quantity_claimed: qty,
                profiles: null,
                bill_guests: { id: guestId, name: guestName ?? '', bill_id: billId, sponsored_by: currentUserId, created_at: '' },
              },
            ],
          };
        }
        if (qty <= 0) {
          return {
            ...item,
            bill_item_claims: item.bill_item_claims.filter((c) => c.user_id !== currentUserId),
          };
        }
        const existing = item.bill_item_claims.find((c) => c.user_id === currentUserId);
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
              guest_id: null,
              claimed_at: '',
              quantity_claimed: qty,
              profiles: { id: currentUserId, display_name: myName, email: null },
              bill_guests: null,
            },
          ],
        };
      })
  );

  function isClaimed(item: LineItemWithClaims) {
    if (claimingAs.type === 'guest') {
      return item.bill_item_claims.some((c) => c.guest_id === claimingAs.guestId);
    }
    return item.bill_item_claims.some((c) => c.user_id === currentUserId);
  }

  function activeGuestId(): string | undefined {
    return claimingAs.type === 'guest' ? claimingAs.guestId : undefined;
  }

  function handleToggle(item: LineItemWithClaims) {
    if (isCurrentUserPaid || isLocked || currentMemberIsDone) return;
    const claimed = isClaimed(item);
    const guestId = activeGuestId();
    const guestName = claimingAs.type === 'guest' ? claimingAs.name : undefined;
    startTransition(async () => {
      addOptimistic({ itemId: item.id, action: claimed ? 'unclaim' : 'claim', guestId, guestName });
      if (claimed) {
        await unclaimItem(item.id, billId, guestId);
      } else {
        await claimItem(item.id, billId, guestId);
      }
      queryClient.invalidateQueries({ queryKey: ['split', billId] });
      queryClient.invalidateQueries({ queryKey: ['bill', billId] });
    });
  }

  async function handleAddGuest() {
    if (!guestNameInput.trim()) return;
    setAddingGuest(true);
    try {
      const result = await addGuest(billId, guestNameInput.trim());
      if ('error' in result) {
        toast.error(result.error);
      } else {
        setClaimingAs({ type: 'guest', guestId: result.id, name: result.name });
        setShowAddGuest(false);
        setGuestNameInput('');
        queryClient.invalidateQueries({ queryKey: ['split', billId] });
      }
    } finally {
      setAddingGuest(false);
    }
  }

  async function handleMerge() {
    if (!mergeItem) return;
    setMerging(true);
    try {
      await updateLineItem(mergeItem.id, billId, {
        name: mergeName,
        quantity: 1,
        unit_price: mergeItem.total_price,
        total_price: mergeItem.total_price,
      });
      queryClient.invalidateQueries({ queryKey: ['split', billId] });
      setMergeItem(null);
    } catch {
      toast.error('Failed to merge item');
    } finally {
      setMerging(false);
    }
  }

  // My guests (sponsored_by me)
  const myGuestIds = useMemo(
    () => new Set(guests.filter((g) => g.sponsored_by === currentUserId).map((g) => g.id)),
    [guests, currentUserId]
  );

  const myShare = useMemo(() => {
    const billSubtotal = totals?.subtotal ?? 0;
    const billTax = totals?.tax ?? 0;
    const billGratuity = totals?.gratuity ?? 0;
    const billFees = totals?.fees ?? 0;
    const billDiscounts = totals?.discounts ?? 0;

    let subtotal = 0;
    for (const item of optimisticItems) {
      for (const claim of item.bill_item_claims) {
        // Include my own claims and my guests' claims
        const isMineClaim = claim.user_id === currentUserId;
        const isMyGuestClaim = claim.guest_id != null && myGuestIds.has(claim.guest_id);
        if (!isMineClaim && !isMyGuestClaim) continue;
        const share =
          item.quantity > 1
            ? (claim.quantity_claimed / item.quantity) * item.total_price
            : item.total_price / item.bill_item_claims.length;
        subtotal += share;
      }
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
  }, [optimisticItems, totals, currentUserId, myGuestIds]);

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
        <div
          className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${allSettled ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
        >
          <div className="flex items-center gap-2">
            {allSettled ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <Lock className="h-4 w-4 shrink-0" />
            )}
            {allSettled
              ? 'All settled up!'
              : 'Bill is locked — no further changes'}
          </div>
          {isOwner && !allSettled && (
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
                disabled={paidUserIds.length > 0}
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
            {isPayer && isLocked && !allSettled && (
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
                  ...members
                    .filter((m) => m.user_id !== payerProfile?.id)
                    .map((m) => ({
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {isLocked
              ? 'Claimed items (bill locked)'
              : isCurrentUserPaid || currentMemberIsDone
                ? 'Your claimed items'
                : 'Tap to claim items'}
          </h2>
          {!isLocked && !isCurrentUserPaid && !currentMemberIsDone && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">for</span>
              <div className="relative">
                <select
                  value={claimingAs.type === 'guest' ? claimingAs.guestId : '__self__'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__self__') {
                      setClaimingAs({ type: 'self' });
                    } else if (val === '__add__') {
                      setShowAddGuest(true);
                    } else {
                      const guest = guests.find((g) => g.id === val);
                      if (guest) setClaimingAs({ type: 'guest', guestId: guest.id, name: guest.name });
                    }
                  }}
                  className="appearance-none bg-background border rounded-md pl-2.5 pr-7 py-1 text-xs font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="__self__">Myself</option>
                  {guests.filter((g) => g.sponsored_by === currentUserId).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                  <option value="__add__">+ Add guest</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              </div>
              {claimingAs.type === 'guest' && (
                <button
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title={`Remove ${claimingAs.name}`}
                  onClick={() => {
                    const { guestId, name } = claimingAs;
                    const hasClaims = optimisticItems.some((item) =>
                      item.bill_item_claims.some((c) => c.guest_id === guestId)
                    );
                    if (hasClaims) {
                      setDeleteGuestConfirm({ guestId, name });
                    } else {
                      removeGuest(guestId, billId).then((result) => {
                        if ('error' in result) {
                          toast.error(result.error);
                        } else {
                          setClaimingAs({ type: 'self' });
                          queryClient.invalidateQueries({ queryKey: ['split', billId] });
                        }
                      });
                    }
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="space-y-0">
          {optimisticItems.map((item) => {
            const guestId = activeGuestId();
            const guestName = claimingAs.type === 'guest' ? claimingAs.name : undefined;
            const myClaim = guestId
              ? item.bill_item_claims.find((c) => c.guest_id === guestId)
              : item.bill_item_claims.find((c) => c.user_id === currentUserId);
            const claimed = !!myClaim;
            const myQty = myClaim?.quantity_claimed ?? 0;

            if (item.quantity > 1) {
              const othersClaimed = item.bill_item_claims
                .filter((c) => guestId ? c.guest_id !== guestId : c.user_id !== currentUserId)
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
                              guestId,
                              guestName,
                            });
                            await setClaimedQuantity(item.id, billId, next, guestId);
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
                              guestId,
                              guestName,
                            });
                            await setClaimedQuantity(item.id, billId, next, guestId);
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
                    {(item.bill_item_claims.length > 0 ||
                      (isOwner && !isLocked)) && (
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {item.bill_item_claims.map((claim) => (
                            <Badge
                              key={claim.guest_id ?? claim.user_id}
                              variant={isActiveClaimerClaim(claim) ? 'default' : 'secondary'}
                              className={`text-xs h-5${readOnly ? ' pointer-events-none' : ''}`}
                            >
                              {claimDisplayName(claim)}: {claim.quantity_claimed}
                            </Badge>
                          ))}
                        </div>
                        {isOwner && !isLocked && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground"
                            title="Merge quantities into one item"
                            onClick={() => {
                              setMergeName(`${item.quantity}x ${item.name}`);
                              setMergeItem(item);
                            }}
                          >
                            <Merge className="h-3 w-3" />
                          </Button>
                        )}
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
                          key={claim.guest_id ?? claim.user_id}
                          variant={isActiveClaimerClaim(claim) ? 'default' : 'secondary'}
                          className="text-xs h-5"
                        >
                          {claimDisplayName(claim)}
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
                type ClaimEntry = {
                  key: string;
                  item: LineItemWithClaims;
                  guestLabel: string | null;
                  qty: number;
                  price: number;
                };
                const entries: ClaimEntry[] = [];
                for (const item of optimisticItems) {
                  for (const claim of item.bill_item_claims) {
                    const isMine = claim.user_id === currentUserId;
                    const isMyGuest = claim.guest_id != null && myGuestIds.has(claim.guest_id);
                    if (!isMine && !isMyGuest) continue;
                    const qty = claim.quantity_claimed ?? 1;
                    const price = item.quantity > 1
                      ? (qty / item.quantity) * item.total_price
                      : item.total_price / item.bill_item_claims.length;
                    entries.push({
                      key: `${item.id}-${claim.guest_id ?? 'self'}`,
                      item,
                      guestLabel: isMyGuest ? (guestNameMap.get(claim.guest_id!) ?? 'Guest') : null,
                      qty,
                      price,
                    });
                  }
                }
                const claimedItemIds = new Set(entries.map((e) => e.item.id));
                const unclaimed = optimisticItems.filter((item) => !claimedItemIds.has(item.id));
                const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
                return (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Your items ({totalQty})
                      </p>
                      {entries.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          None — you haven&apos;t claimed anything.
                        </p>
                      ) : (
                        <div className="space-y-0">
                          {entries.map((entry) => (
                            <div
                              key={entry.key}
                              className="flex items-baseline justify-between gap-2 py-1.5 border-b last:border-b-0 text-sm overflow-hidden"
                            >
                              <div className="flex items-baseline gap-1 min-w-0 flex-1 overflow-hidden">
                                <p className="font-medium truncate">{entry.item.name}</p>
                                {entry.item.quantity > 1 && (
                                  <span className="shrink-0 text-muted-foreground">×{entry.qty}</span>
                                )}
                                {entry.item.quantity === 1 && entry.item.bill_item_claims.length > 1 && (
                                  <span className="shrink-0 text-muted-foreground">shared</span>
                                )}
                                {entry.guestLabel && (
                                  <span className="shrink-0 text-muted-foreground">for {entry.guestLabel}</span>
                                )}
                              </div>
                              <span className="shrink-0 text-muted-foreground">
                                {formatCurrency(entry.price, currency)}
                              </span>
                            </div>
                          ))}
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
                              <p className="truncate min-w-0 flex-1">{item.name}</p>
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

      {/* Mark As Paid Modal — triggered by ?action=mark-paid from email link */}
      {!isPayer && (
        <Suspense fallback={null}>
          <MarkAsPaidModal
            billId={billId}
            billName={billName}
            payerName={payerName}
            currentUserIsPaid={isCurrentUserPaid}
            onPaid={() => {
              queryClient.invalidateQueries({ queryKey: ['split', billId] });
            }}
          />
        </Suspense>
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
            {(() => {
              type ClaimEntry = {
                key: string;
                item: LineItemWithClaims;
                guestLabel: string | null;
                qty: number;
                price: number;
              };
              const entries: ClaimEntry[] = [];
              for (const item of optimisticItems) {
                for (const claim of item.bill_item_claims) {
                  const isMine = claim.user_id === currentUserId;
                  const isMyGuest = claim.guest_id != null && myGuestIds.has(claim.guest_id);
                  if (!isMine && !isMyGuest) continue;
                  const qty = claim.quantity_claimed ?? 1;
                  const price = item.quantity > 1
                    ? (qty / item.quantity) * item.total_price
                    : item.total_price / item.bill_item_claims.length;
                  entries.push({
                    key: `${item.id}-${claim.guest_id ?? 'self'}`,
                    item,
                    guestLabel: isMyGuest ? (guestNameMap.get(claim.guest_id!) ?? 'Guest') : null,
                    qty,
                    price,
                  });
                }
              }
              const totalQty = entries.reduce((sum, e) => sum + e.qty, 0);
              return (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Your items ({totalQty})
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      None — you haven&apos;t claimed anything.
                    </p>
                  ) : (
                    <div className="space-y-0">
                      {entries.map((entry) => (
                        <div
                          key={entry.key}
                          className="flex items-baseline justify-between gap-2 py-1.5 border-b last:border-b-0 text-sm overflow-hidden"
                        >
                          <div className="flex items-baseline gap-1 min-w-0 flex-1 overflow-hidden">
                            <p className="font-medium truncate">{entry.item.name}</p>
                            {entry.item.quantity > 1 && (
                              <span className="shrink-0 text-muted-foreground">×{entry.qty}</span>
                            )}
                            {entry.item.quantity === 1 && entry.item.bill_item_claims.length > 1 && (
                              <span className="shrink-0 text-muted-foreground">shared</span>
                            )}
                            {entry.guestLabel && (
                              <span className="shrink-0 text-muted-foreground">for {entry.guestLabel}</span>
                            )}
                          </div>
                          <span className="shrink-0 text-muted-foreground">
                            {formatCurrency(entry.price, currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="space-y-1 text-sm pt-2 border-t">
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
              <div className="flex justify-between font-semibold text-foreground pt-1">
                <span>Your total</span>
                <span>{formatCurrency(myShare.total, currency)}</span>
              </div>
            </div>

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
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Pay {payerName}
                  </p>
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
              <div className="flex items-center justify-between">
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

      {/* Add Guest Modal */}
      <Dialog
        open={showAddGuest}
        onOpenChange={(open) => {
          if (!open) { setShowAddGuest(false); setGuestNameInput(''); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a guest</DialogTitle>
            <DialogDescription>
              Paying for someone who doesn&apos;t have an account? Add them as a guest so you can claim items on their behalf. Their costs will roll up into your total.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Guest name (e.g. Jane)"
            value={guestNameInput}
            onChange={(e) => setGuestNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddGuest(); }
            }}
            className="text-sm"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowAddGuest(false); setGuestNameInput(''); }}
            >
              Cancel
            </Button>
            <Button
              disabled={addingGuest || !guestNameInput.trim()}
              onClick={handleAddGuest}
            >
              {addingGuest ? 'Adding…' : 'Add guest'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Guest Warning Modal */}
      <Dialog
        open={!!deleteGuestConfirm}
        onOpenChange={(open) => { if (!open) setDeleteGuestConfirm(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove {deleteGuestConfirm?.name}?</DialogTitle>
            <DialogDescription>
              {deleteGuestConfirm?.name} has claimed items on this bill. Removing them will also delete all their claims.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteGuestConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteGuestConfirm) return;
                const result = await removeGuest(deleteGuestConfirm.guestId, billId);
                if ('error' in result) {
                  toast.error(result.error);
                } else {
                  setClaimingAs({ type: 'self' });
                  queryClient.invalidateQueries({ queryKey: ['split', billId] });
                }
                setDeleteGuestConfirm(null);
              }}
            >
              Remove guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!mergeItem}
        onOpenChange={(open) => {
          if (!open) setMergeItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge quantities</DialogTitle>
            <DialogDescription>
              Combine {mergeItem?.quantity} portions into 1 shared item to split
              evenly.
            </DialogDescription>
          </DialogHeader>
          {mergeItem && (
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Current:</span>{' '}
                  {mergeItem.quantity} × {mergeItem.name} @{' '}
                  {formatCurrency(mergeItem.unit_price, currency)} ={' '}
                  {formatCurrency(mergeItem.total_price, currency)}
                </p>
                <p>
                  <span className="font-medium">Merged:</span> 1 ×{' '}
                  {mergeName || `${mergeItem.quantity}x ${mergeItem.name}`} @{' '}
                  {formatCurrency(mergeItem.total_price, currency)} ={' '}
                  {formatCurrency(mergeItem.total_price, currency)}
                </p>
              </div>
              <Input
                value={mergeName}
                onChange={(e) => setMergeName(e.target.value)}
                placeholder="Merged item name"
                className="text-sm"
              />
            </div>
          )}
          <p className="sm:hidden text-xs text-center text-amber-600 dark:text-amber-400 w-full">
            Warning: This cannot be undone.
          </p>
          <DialogFooter>
            <p className="hidden sm:block text-xs self-center text-amber-600 dark:text-amber-400 w-full mb-1">
              Warning: This cannot be undone.
            </p>
            <Button variant="outline" onClick={() => setMergeItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleMerge}
              disabled={merging || !mergeName.trim()}
            >
              {merging ? 'Merging…' : 'Merge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
