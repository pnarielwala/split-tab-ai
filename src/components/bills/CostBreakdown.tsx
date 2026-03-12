import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import type { ParticipantShare } from "@/types/database";

interface CostBreakdownProps {
  shares: ParticipantShare[];
  currency: string;
  currentUserId: string;
}

export function CostBreakdown({ shares, currency, currentUserId }: CostBreakdownProps) {
  if (shares.length === 0) return null;

  const sorted = [...shares].sort((a, b) => {
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    return b.total - a.total;
  });

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        Each person&apos;s share of the bill based on what they claimed, with tax and fees prorated proportionally.
      </p>
      <div className="space-y-3">
        {sorted.map((share) => {
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
