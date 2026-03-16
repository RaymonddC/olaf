import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const figtree = Figtree({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-heading',
    display: 'swap',
});

const notoSans = Noto_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    variable: '--font-body',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'OLAF | Your Care Companion',
    description: 'An AI care companion for elderly users and their families.',
    manifest: '/manifest.json',
    appleWebApp: { capable: true, statusBarStyle: 'default', title: 'OLAF' },
    icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
    },
};

export const viewport: Viewport = {
    themeColor: '#00897b',
    width: 'device-width',
    initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${figtree.variable} ${notoSans.variable}`}>
        <body className="font-body bg-mesh text-text-primary min-h-dvh">
        {/* Fixed animated mesh orbs */}
        <div className="mesh-orb mesh-orb-1" aria-hidden="true" />
        <div className="mesh-orb mesh-orb-2" aria-hidden="true" />
        <div className="mesh-orb mesh-orb-3" aria-hidden="true" />

        <Providers>{children}</Providers>
        </body>
        </html>
    );
}