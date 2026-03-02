"use client";

import { useMemo, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { claimItem, unclaimItem } from "@/app/actions/bills";
import type {
  LineItemWithClaims,
  BillTotal,
  BillMemberWithProfile,
  Profile,
  ParticipantShare,
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

  // Build map of all participants: owner + members
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

  // Compute per-participant cost shares
  const shares = useMemo<ParticipantShare[]>(() => {
    const billSubtotal = totals?.subtotal ?? 0;
    const billTax = totals?.tax ?? 0;
    const billGratuity = totals?.gratuity ?? 0;

    const subtotals = new Map<string, number>();
    for (const item of lineItems) {
      const count = item.bill_item_claims.length;
      if (count === 0) continue;
      const share = item.total_price / count;
      for (const claim of item.bill_item_claims) {
        subtotals.set(claim.user_id, (subtotals.get(claim.user_id) ?? 0) + share);
      }
    }

    const result: ParticipantShare[] = [];
    for (const [userId, displayName] of participantMap.entries()) {
      const sub = subtotals.get(userId) ?? 0;
      if (sub === 0) continue;
      const ratio = billSubtotal > 0 ? sub / billSubtotal : 0;
      const tax = billTax * ratio;
      const gratuity = billGratuity * ratio;
      result.push({
        userId,
        displayName,
        subtotal: sub,
        tax,
        gratuity,
        total: sub + tax + gratuity,
      });
    }

    return result.sort((a, b) => b.total - a.total);
  }, [lineItems, totals, participantMap]);

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

      {/* Cost breakdown */}
      {shares.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Cost breakdown
          </h2>
          <div className="space-y-3">
            {shares.map((share) => {
              const isMe = share.userId === currentUserId;
              return (
                <Card
                  key={share.userId}
                  className={isMe ? "border-primary ring-1 ring-primary" : ""}
                >
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>
                        {share.displayName}
                        {isMe && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </span>
                      <span className="text-base font-bold">
                        {formatCurrency(share.total, currency)}
                      </span>
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
                        <span>Tip (prorated)</span>
                        <span>{formatCurrency(share.gratuity, currency)}</span>
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
      )}

      {shares.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Tap items above to see your cost breakdown.
        </p>
      )}
    </div>
  );
}
