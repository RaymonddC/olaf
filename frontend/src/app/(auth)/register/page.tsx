'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Registration is now handled via Google sign-in on /family-login.
 * Redirect any visitors here to that page.
 */
export default function RegisterPage() {
    const router = useRouter();
    useEffect(() => { router.replace('/family-login'); }, [router]);
    return null;
}
