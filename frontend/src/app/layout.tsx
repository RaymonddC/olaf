import type { Metadata, Viewport } from 'next';
import { Figtree, Noto_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
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
  title: 'CARIA — Your Care Companion',
  description: 'An AI care companion for elderly users and their families.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'CARIA',
  },
};

export const viewport: Viewport = {
  themeColor: '#0369A1',
  width: 'device-width',
  initialScale: 1,
  // Do NOT disable zoom — WCAG requirement
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${figtree.variable} ${notoSans.variable}`}>
      <body className="font-body bg-bg-page text-text-primary min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
