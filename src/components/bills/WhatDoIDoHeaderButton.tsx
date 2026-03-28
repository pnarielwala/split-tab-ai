'use client';

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSplitPageData } from '@/app/actions/queries';
import { WhatDoIDoButton } from './WhatDoIDoButton';

const LS_KEY_JOIN = 'helpModal_suppressJoinOpen';
const LS_KEY_CREATED = 'helpModal_suppressCreatedOpen';
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

interface WhatDoIDoHeaderButtonProps {
  billId: string;
  currentUserId: string;
  isOwner: boolean;
}

export function WhatDoIDoHeaderButton({
  billId,
  currentUserId,
  isOwner,
}: WhatDoIDoHeaderButtonProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isJoinFlow = searchParams.get('joined') === '1';
  const isCreatedFlow = searchParams.get('created') === '1';
  const isAnyAutoFlow = isJoinFlow || isCreatedFlow;

  const [autoOpen, setAutoOpen] = useState(false);
  const [showSuppressOption, setShowSuppressOption] = useState(false);
  const [hasHandledJoinFlow, setHasHandledJoinFlow] = useState(false);
  const [activeLsKey, setActiveLsKey] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['split', billId],
    queryFn: () => getSplitPageData(billId),
  });

  const members = data?.members ?? [];
  const totals = data?.totals ?? null;
  const ownerProfile = data?.ownerProfile;
  const payerProfile = data?.payerProfile;
  const paidUserIds = data?.paidUserIds ?? [];
  const isPayer = currentUserId === payerProfile?.id;
  const currency = totals?.currency ?? 'USD';
  const isLocked = data?.isLocked ?? false;
  const memberDoneStatuses = data?.memberDoneStatuses ?? [];
  const allMembersDone =
    memberDoneStatuses.length > 0 && memberDoneStatuses.every((m) => m.isDone);

  const serverItems = data?.lineItems ?? [];

  const myShare = useMemo(() => {
    const billSubtotal = totals?.subtotal ?? 0;
    const billTax = totals?.tax ?? 0;
    const billGratuity = totals?.gratuity ?? 0;
    const billFees = totals?.fees ?? 0;
    const billDiscounts = totals?.discounts ?? 0;

    let subtotal = 0;
    for (const item of serverItems) {
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
    return subtotal + tax + gratuity + fees - discounts;
  }, [serverItems, totals, currentUserId]);

  const hasClaimed = serverItems.some((item) =>
    item.bill_item_claims.some((c) => c.user_id === currentUserId)
  );

  const nonPayerParticipantIds = [
    ...(ownerProfile && ownerProfile.id !== payerProfile?.id
      ? [ownerProfile.id]
      : []),
    ...members
      .filter((m) => m.user_id !== payerProfile?.id)
      .map((m) => m.user_id),
  ];

  const payerName = payerProfile?.display_name ?? 'Payer';

  useEffect(() => {
    if (!isAnyAutoFlow || !data || hasHandledJoinFlow) return;
    setHasHandledJoinFlow(true);

    router.replace(`/bills/${billId}`);

    const lsKey = isCreatedFlow ? LS_KEY_CREATED : LS_KEY_JOIN;
    let suppressed = false;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const { suppressedAt } = JSON.parse(raw);
        if (Date.now() - suppressedAt < NINETY_DAYS) suppressed = true;
      }
    } catch {
      /* ignore */
    }

    if (!suppressed) {
      setActiveLsKey(lsKey);
      setAutoOpen(true);
      setShowSuppressOption(true);
    }
  }, [isAnyAutoFlow, isCreatedFlow, data, hasHandledJoinFlow, billId, router]);

  if (!data) return null;

  return (
    <WhatDoIDoButton
      isOwner={isOwner}
      isPayer={isPayer}
      isLocked={isLocked}
      membersCount={members.length}
      memberDoneStatuses={memberDoneStatuses}
      allMembersDone={allMembersDone}
      paidUserIds={paidUserIds}
      currentUserId={currentUserId}
      payerName={payerName}
      myShareTotal={myShare}
      currency={currency}
      hasClaimed={hasClaimed}
      nonPayerParticipantIds={nonPayerParticipantIds}
      defaultOpen={autoOpen}
      isJoinFlow={showSuppressOption}
      suppressLabel={
        activeLsKey === LS_KEY_CREATED
          ? 'Stop showing this when I create a bill for 90 days'
          : 'Stop showing this when I join a bill for 90 days'
      }
      onSuppressJoinFlow={() => {
        try {
          if (activeLsKey)
            localStorage.setItem(
              activeLsKey,
              JSON.stringify({ suppressedAt: Date.now() })
            );
        } catch {
          /* ignore */
        }
      }}
      onClose={() => setShowSuppressOption(false)}
    />
  );
}
