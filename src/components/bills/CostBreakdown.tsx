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

  return (
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
