'use client';

import { useRouter } from 'next/navigation';

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
    >
      ← Back
    </button>
  );
}
