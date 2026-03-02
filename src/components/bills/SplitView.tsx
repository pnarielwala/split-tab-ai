"use client";

import { useMemo, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { claimItem, unclaimItem } from "@/app/actions/bills";
import type {
  LineItemWithClaims,
  BillTotal,
  BillMemberWithProfile,
  Profile,
} from "@/types/database";

interface SplitViewProps {
  billId: string;
  currentUserId: string;
  lineItems: LineItemWithClaims[];
  totals: BillTotal | null;
  members: BillMemberWithProfile[];
  ownerProfile: Profile;
}

export function SplitView({
  billId,
  currentUserId,
  lineItems,
  totals,
  members,
  ownerProfile,
}: SplitViewProps) {
  const [isPending, startTransition] = useTransition();
  const currency = totals?.currency ?? "USD";

  // Build map of all participants: owner + members (for badge display names)
  const participantMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set(ownerProfile.id, ownerProfile.display_name);
    for (const m of members) {
      map.set(m.user_id, m.profiles.display_name);
    }
    return map;
  }, [ownerProfile, members]);

  function isClaimed(item: LineItemWithClaims) {
    return item.bill_item_claims.some((c) => c.user_id === currentUserId);
  }

  function handleToggle(item: LineItemWithClaims) {
    startTransition(async () => {
      if (isClaimed(item)) {
        await unclaimItem(item.id, billId);
      } else {
        await claimItem(item.id, billId);
      }
    });
  }

  const myShare = useMemo(() => {
    const billSubtotal = totals?.subtotal ?? 0;
    const billTax = totals?.tax ?? 0;
    const billGratuity = totals?.gratuity ?? 0;

    let subtotal = 0;
    for (const item of lineItems) {
      const claimed = item.bill_item_claims.some((c) => c.user_id === currentUserId);
      if (!claimed) continue;
      const splitCount = item.bill_item_claims.length;
      subtotal += item.total_price / splitCount;
    }

    if (subtotal === 0) return null;

    const ratio = billSubtotal > 0 ? subtotal / billSubtotal : 0;
    const tax = billTax * ratio;
    const gratuity = billGratuity * ratio;
    return { subtotal, tax, gratuity, total: subtotal + tax + gratuity };
  }, [lineItems, totals, currentUserId]);

  return (
    <div className="space-y-6">
      {/* Item list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Tap to claim items
        </h2>
        <div className="space-y-0">
          {lineItems.map((item) => {
            const claimed = isClaimed(item);
            return (
              <button
                key={item.id}
                onClick={() => handleToggle(item)}
                disabled={isPending}
                className="w-full text-left border-b last:border-b-0 py-3 flex items-start gap-3 hover:bg-muted/40 active:bg-muted/60 transition-colors disabled:opacity-60"
              >
                {/* Claim indicator */}
                <span
                  className={`mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    claimed
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {claimed && (
                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                  )}
                </span>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
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
                          variant={claim.user_id === currentUserId ? "default" : "secondary"}
                          className="text-xs h-5"
                        >
                          {participantMap.get(claim.user_id) ?? claim.profiles.display_name}
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
                <span>Tip (prorated)</span>
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
