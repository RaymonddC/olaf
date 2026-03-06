'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /link-elder now redirects to /setup-elder.
 * Family members set up the elder's account directly — no manual ID linking needed.
 */
export default function LinkElderPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/setup-elder');
  }, [router]);

  return null;
}
