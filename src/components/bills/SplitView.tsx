'use client';

import { useMemo, useOptimistic, startTransition } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { claimItem, unclaimItem } from '@/app/actions/bills';
import { getSplitPageData } from '@/app/actions/queries';
import type { LineItemWithClaims } from '@/types/database';

interface SplitViewProps {
  billId: string;
  currentUserId: string;
}

export function SplitView({ billId, currentUserId }: SplitViewProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['split', billId],
    queryFn: () => getSplitPageData(billId),
  });

  const serverItems = data?.lineItems ?? [];
  const totals = data?.totals ?? null;
  const members = data?.members ?? [];
  const ownerProfile = data?.ownerProfile;
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

    let subtotal = 0;
    for (const item of optimisticItems) {
      const claimed = item.bill_item_claims.some(
        (c) => c.user_id === currentUserId
      );
      if (!claimed) continue;
      const splitCount = item.bill_item_claims.length;
      subtotal += item.total_price / splitCount;
    }

    if (subtotal === 0) return null;

    const ratio = billSubtotal > 0 ? subtotal / billSubtotal : 0;
    const tax = billTax * ratio;
    const gratuity = billGratuity * ratio;
    return { subtotal, tax, gratuity, total: subtotal + tax + gratuity };
  }, [optimisticItems, totals, currentUserId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-4 w-32 mb-3" />
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Item list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Tap to claim items
        </h2>
        <div className="space-y-0">
          {optimisticItems.map((item) => {
            const claimed = isClaimed(item);
            return (
              <button
                key={item.id}
                onClick={() => handleToggle(item)}
                className="w-full text-left border-b last:border-b-0 py-3 flex items-center gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors"
              >
                {/* Claim indicator */}
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

                {/* Item info */}
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
                  {/* Claimant badges */}
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

      {/* My cost breakdown */}
      {myShare ? (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Your total
          </h2>
          <div className="rounded-lg border p-4 space-y-1.5 text-sm">
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
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold text-base">
              <span>Total</span>
              <span>{formatCurrency(myShare.total, currency)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">
          Tap items above to see your total.
        </p>
      )}
    </div>
  );
}
