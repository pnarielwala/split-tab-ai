'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSplitPageData } from '@/app/actions/queries';
import { WhatDoIDoButton } from './WhatDoIDoButton';

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
    />
  );
}
