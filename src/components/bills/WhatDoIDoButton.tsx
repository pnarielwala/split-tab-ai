'use client';

import { useState } from 'react';
import { HelpCircle, CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';

interface WhatDoIDoButtonProps {
  isOwner: boolean;
  isPayer: boolean;
  isLocked: boolean;
  membersCount: number;
  memberDoneStatuses: { userId: string; isDone: boolean }[];
  allMembersDone: boolean;
  paidUserIds: string[];
  currentUserId: string;
  payerName: string;
  myShareTotal: number;
  currency: string;
  hasClaimed: boolean;
  nonPayerParticipantIds: string[];
}

interface Step {
  title: string;
  description: string;
  subtitle?: string;
  done: boolean;
}

interface ScenarioInfo {
  roleIntro: string;
  steps: Step[];
}

function computeScenario(props: WhatDoIDoButtonProps): ScenarioInfo {
  const {
    isOwner,
    isPayer,
    isLocked,
    membersCount,
    memberDoneStatuses,
    paidUserIds,
    currentUserId,
    payerName,
    myShareTotal,
    currency,
    hasClaimed,
    nonPayerParticipantIds,
  } = props;

  const safeMembersDone =
    memberDoneStatuses.length > 0 && memberDoneStatuses.every((m) => m.isDone);
  const doneCount = memberDoneStatuses.filter((m) => m.isDone).length;
  const totalCount = memberDoneStatuses.length;

  const nonPayersPaidCount = nonPayerParticipantIds.filter((id) =>
    paidUserIds.includes(id)
  ).length;
  const allNonPayersPaid =
    nonPayerParticipantIds.length > 0 &&
    nonPayerParticipantIds.every((id) => paidUserIds.includes(id));

  const myDoneStatus =
    memberDoneStatuses.find((m) => m.userId === currentUserId)?.isDone ?? false;
  const amIPaid = paidUserIds.includes(currentUserId);
  const stillOwed = nonPayerParticipantIds.length - nonPayersPaidCount;

  if (isOwner) {
    if (!isLocked) {
      return {
        roleIntro:
          'You created this bill. Your job is to get everyone to claim their items, then lock the bill so splits are finalized and payment can begin.',
        steps: [
          {
            title: 'Share the invite link',
            description:
              'Tap the "Invite" button and send the link to everyone who was at the table. They\'ll join the bill and be able to tap the items they ordered.',
            subtitle:
              membersCount > 0
                ? `${membersCount} member${membersCount !== 1 ? 's' : ''} joined`
                : undefined,
            done: membersCount > 0,
          },
          {
            title: 'Wait for members to claim their items',
            description:
              'Each person taps the items they ordered. You can see their progress in the "Member status" section below. Once everyone is done, you\'ll be able to lock the bill.',
            subtitle:
              totalCount > 0
                ? `${doneCount} of ${totalCount} members done`
                : undefined,
            done: safeMembersDone,
          },
          {
            title: 'Lock the bill',
            description:
              'Once everyone has claimed their items, tap "Lock bill". This finalizes all the splits so no one can make further changes. The payer can then start collecting payment.',
            done: false,
          },
        ],
      };
    } else if (isPayer) {
      return {
        roleIntro:
          "You created this bill and you're the one who paid for it. The bill is locked — now it's time to collect from everyone else.",
        steps: [
          {
            title: 'Bill is locked',
            description:
              'All splits are finalized. No one can change their claimed items anymore.',
            done: true,
          },
          {
            title: 'Send payment reminders',
            description:
              'Use the "Request payment" button to send email reminders to anyone who hasn\'t paid yet. The email includes your payment links (Venmo, Zelle, etc.) so they can send you money directly.',
            subtitle: allNonPayersPaid
              ? 'All members have paid'
              : `${stillOwed} member${stillOwed !== 1 ? 's' : ''} still need to pay`,
            done: allNonPayersPaid,
          },
          {
            title: 'Mark members as paid when settled',
            description:
              'Once someone pays you, open "Request payment" and tap "Mark paid" next to their name. This keeps everyone on the same page.',
            done: allNonPayersPaid,
          },
        ],
      };
    } else {
      return {
        roleIntro: `You created this bill, but ${payerName} is the one who paid for it. The bill is locked — you owe ${payerName} your share.`,
        steps: [
          {
            title: 'Bill is locked',
            description:
              'All splits are finalized. Your share has been calculated based on the items you claimed.',
            done: true,
          },
          {
            title: `Pay ${payerName} ${formatCurrency(myShareTotal, currency)}`,
            description: `Send ${payerName} your share using their preferred payment method. Tap "You owe ${formatCurrency(myShareTotal, currency)}" on the bill page to view their payment methods like Venmo or Zelle.`,
            done: amIPaid,
          },
          {
            title: 'Mark yourself as paid',
            description: `After you've sent the money, tap "You owe ${formatCurrency(myShareTotal, currency)}" and mark yourself as paid so ${payerName} knows to expect it.`,
            done: amIPaid,
          },
        ],
      };
    }
  } else {
    // Member
    if (!isLocked) {
      return {
        roleIntro:
          "You've joined this bill. Your job right now is to tap the items you ordered so the app knows what you owe.",
        steps: [
          {
            title: 'Claim your items',
            description:
              'Scroll through the list and tap each item you ordered. If you split something with others, multiple people can claim the same item and the cost will be divided evenly.',
            done: hasClaimed,
          },
          {
            title: 'Tap "I\'m done"',
            description:
              "Once you've claimed everything you ordered, tap the \"I'm done\" button. This lets the bill owner know you're ready. You can undo this if you need to make changes.",
            done: myDoneStatus,
          },
          {
            title: 'Wait for the owner to lock the bill',
            description:
              "Once everyone is done claiming, the owner will lock the bill. You'll then be able to see your final total and pay your share.",
            done: false,
          },
        ],
      };
    } else if (isPayer) {
      return {
        roleIntro:
          "You're the one who paid for this bill. The bill is locked — now it's time to collect your money back from the others.",
        steps: [
          {
            title: 'Bill is locked',
            description:
              "All splits are finalized. Everyone's share has been calculated.",
            done: true,
          },
          {
            title: 'Collect payment from others',
            description:
              'The bill owner can send payment reminders on your behalf, or you can follow up directly with each person. Share your Venmo, Zelle, or other payment details so they can pay you.',
            subtitle: allNonPayersPaid
              ? 'All members have paid'
              : `${stillOwed} member${stillOwed !== 1 ? 's' : ''} still need to pay`,
            done: allNonPayersPaid,
          },
          {
            title: 'Mark members as paid when settled',
            description:
              'Once someone pays you, the bill owner can mark them as paid in the "Request payment" dialog. This keeps the payment status up to date for everyone.',
            done: allNonPayersPaid,
          },
        ],
      };
    } else {
      return {
        roleIntro: `You're a member of this bill. The bill is locked — your share has been calculated and it's time to pay ${payerName} back.`,
        steps: [
          {
            title: 'Splits are final',
            description:
              'Your share has been calculated based on the items you claimed, plus your portion of tax, tip, and fees.',
            done: true,
          },
          {
            title: `Pay ${payerName} ${formatCurrency(myShareTotal, currency)}`,
            description: `Send ${payerName} your share using their preferred payment method. Tap "You owe ${formatCurrency(myShareTotal, currency)}" on the bill page to view their payment methods like Venmo or Zelle.`,
            done: amIPaid,
          },
          {
            title: 'Mark yourself as paid',
            description: `After sending the money, tap "You owe ${formatCurrency(myShareTotal, currency)}" and mark yourself as paid so ${payerName} knows to expect your payment.`,
            done: amIPaid,
          },
        ],
      };
    }
  }
}

export function WhatDoIDoButton(props: WhatDoIDoButtonProps) {
  const [open, setOpen] = useState(false);
  const { roleIntro, steps } = computeScenario(props);
  const currentStepIndex = steps.findIndex((s) => !s.done);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" />
        What do I do?
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>What do I do?</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">{roleIntro}</p>

          <div className="space-y-4 mt-1">
            {steps.map((step, i) => {
              const isCurrent = i === currentStepIndex;
              return (
                <div key={i} className="flex items-start gap-3">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : isCurrent ? (
                    <CircleDot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p
                      className={`text-sm font-medium leading-snug${step.done ? ' text-muted-foreground' : ''}`}
                    >
                      {step.title}
                    </p>
                    {isCurrent && (
                      <span className="text-xs font-medium text-primary bg-primary/10 rounded px-1.5 py-0.5 leading-none inline-block">
                        You are here
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                    {step.subtitle && (
                      <p className="text-xs font-medium text-muted-foreground mt-1">
                        {step.subtitle}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Got it!</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
