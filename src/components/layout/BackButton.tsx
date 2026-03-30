'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackHref: string;
}

export function BackButton({ fallbackHref }: BackButtonProps) {
  const router = useRouter();

  function handleBack() {
    const referrer = document.referrer;
    const cameFromApp = referrer && new URL(referrer).origin === window.location.origin;
    if (cameFromApp) {
      router.back();
    } else {
      router.replace(fallbackHref);
    }
  }

  return (
    <button
      onClick={handleBack}
      className="mr-2 -ml-2 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md"
      aria-label="Go back"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
