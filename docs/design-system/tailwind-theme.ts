/**
 * OLAF Design System — Tailwind Theme Configuration
 * Version: 2.0.0
 *
 * Source: UI/UX Pro Max — Senior Care/Elderly palette + Medical Clean typography
 * Style: Accessible & Ethical (WCAG AAA target)
 *
 * Usage in tailwind.config.ts:
 *
 *   import type { Config } from 'tailwindcss';
 *   import { olafTheme } from './docs/design-system/tailwind-theme';
 *
 *   const config: Config = {
 *     content: ['./src/**\/*.{js,ts,jsx,tsx,mdx}'],
 *     theme: { extend: olafTheme },
 *     plugins: [],
 *   };
 *   export default config;
 *
 * Font setup (in src/app/layout.tsx):
 *
 *   import { Figtree, Noto_Sans } from 'next/font/google';
 *
 *   const figtree = Figtree({
 *     subsets: ['latin'],
 *     weight: ['400', '500', '600', '700'],
 *     variable: '--font-heading',
 *     display: 'swap',
 *   });
 *
 *   const notoSans = Noto_Sans({
 *     subsets: ['latin'],
 *     weight: ['400', '500', '600', '700'],
 *     variable: '--font-body',
 *     display: 'swap',
 *   });
 *
 *   // <body className={`${figtree.variable} ${notoSans.variable} font-body`}>
 */

export const olafTheme = {
  // ─── Colors ────────────────────────────────────────────────────────
  // Primary: Calm blue — trust & stability (Senior Care/Elderly palette)
  // Accent: Reassuring green — health & confirmation
  // Warm: Amber companion warmth — care & personality
  colors: {
    // Primary — Mint Teal (based on OLAF logo palette, #00897B anchor)
    primary: {
      50: '#E0F2F1',
      100: '#B2DFDB',
      200: '#80CBC4',
      300: '#4DB6AC',
      400: '#26A69A',
      500: '#009688',
      600: '#00897B',
      700: '#00796B', // Primary buttons, active nav
      800: '#00695C', // Headings
      900: '#004D40', // Body text
    },

    // Accent — Reassuring Green (health, success, CTA)
    accent: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      200: '#BBF7D0',
      300: '#86EFAC',
      400: '#4ADE80',
      500: '#22C55E',
      600: '#16A34A',
      700: '#15803D', // Success text
      800: '#166534',
      900: '#14532D',
    },

    // Warm — Companion Warmth (amber, care personality)
    warm: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309', // Warning text
      800: '#92400E',
      900: '#78350F',
    },

    // Semantic
    success: {
      50: '#F0FDF4',
      100: '#DCFCE7',
      600: '#16A34A',
      700: '#15803D',
    },
    warning: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      600: '#D97706',
      700: '#B45309',
    },
    error: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      600: '#DC2626',
      700: '#B91C1C',
    },
    info: {
      50: '#F0F9FF',
      100: '#E0F2FE',
      600: '#0284C7',
      700: '#0369A1',
    },

    // Backgrounds & Surfaces
    bg: {
      page: '#F0F7F6',       // primary-50 — soft teal tint
      surface: '#FFFFFF',
      'surface-alt': '#F4F9F8',
      muted: '#E0EEEC',
      overlay: 'rgba(0, 77, 64, 0.5)', // primary-900 @ 50%
    },

    // Text
    text: {
      primary: '#004D40',     // primary-900
      heading: '#00695C',      // primary-800
      secondary: '#334155',    // slate-700
      muted: '#64748B',        // slate-500
      'on-primary': '#FFFFFF',
      'on-accent': '#FFFFFF',
    },

    // Borders
    border: {
      DEFAULT: '#CBD5E1',      // slate-300
      strong: '#94A3B8',       // slate-400
      focus: '#00796B',        // primary-700
    },
  },

  // ─── Typography ────────────────────────────────────────────────────
  // Medical Clean pairing: Figtree (headings) + Noto Sans (body)
  // Loaded via next/font/google with CSS variables
  fontFamily: {
    heading: ['var(--font-heading)', 'Figtree', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    body: ['var(--font-body)', 'Noto Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
    // Alias 'sans' to body for default text
    sans: ['var(--font-body)', 'Noto Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  },

  fontSize: {
    // [size, { lineHeight, letterSpacing, fontWeight }]
    display: ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
    h1: ['2rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
    h2: ['1.75rem', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '600' }],
    h3: ['1.5rem', { lineHeight: '1.35', letterSpacing: '0em', fontWeight: '600' }],
    h4: ['1.25rem', { lineHeight: '1.4', letterSpacing: '0em', fontWeight: '600' }],
    'body-lg': ['1.25rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
    body: ['1.125rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
    'body-sm': ['1rem', { lineHeight: '1.6', letterSpacing: '0.01em', fontWeight: '400' }],
    caption: ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.02em', fontWeight: '400' }],
  },

  // ─── Border Radius ─────────────────────────────────────────────────
  borderRadius: {
    card: '1rem',       // 16px — cards, containers
    button: '0.75rem',  // 12px — buttons
    input: '0.625rem',  // 10px — form inputs
  },

  // ─── Box Shadows ───────────────────────────────────────────────────
  // Tinted with primary-900 (#004D40) for warmth — never pure black
  boxShadow: {
    sm: '0 1px 3px rgba(0, 77, 64, 0.08)',
    md: '0 4px 12px rgba(0, 77, 64, 0.1)',
    lg: '0 8px 24px rgba(0, 77, 64, 0.12)',
    glow: '0 0 0 4px rgba(0, 121, 107, 0.2)', // Focus ring: primary-700 @ 20%
  },

  // ─── Animations ────────────────────────────────────────────────────
  animation: {
    skeleton: 'skeleton 2s ease-in-out infinite',
    'voice-pulse': 'voice-pulse 2s ease-in-out infinite',
    'status-pulse': 'status-pulse 1.5s ease-in-out infinite',
    'modal-in': 'modal-in 200ms ease-out forwards',
    'modal-out': 'modal-out 150ms ease-in forwards',
    'slide-in': 'slide-in 300ms ease-out forwards',
  },

  keyframes: {
    skeleton: {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.5' },
    },
    'voice-pulse': {
      '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
      '50%': { transform: 'scale(1.08)', opacity: '0.3' },
    },
    'status-pulse': {
      '0%, 100%': { opacity: '1' },
      '50%': { opacity: '0.4' },
    },
    'modal-in': {
      '0%': { opacity: '0', transform: 'scale(0.95)' },
      '100%': { opacity: '1', transform: 'scale(1)' },
    },
    'modal-out': {
      '0%': { opacity: '1', transform: 'scale(1)' },
      '100%': { opacity: '0', transform: 'scale(0.95)' },
    },
    'slide-in': {
      '0%': { opacity: '0', transform: 'translateY(-12px)' },
      '100%': { opacity: '1', transform: 'translateY(0)' },
    },
  },
} as const;
