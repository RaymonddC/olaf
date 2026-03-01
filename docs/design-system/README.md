# CARIA Design System

**Version:** 2.0.0
**Last Updated:** 2026-03-01
**Target:** Elderly-first AI care companion (Next.js 14+ PWA + Tailwind CSS)
**Design Style:** Accessible & Ethical (via UI/UX Pro Max methodology)
**Color Palette:** Senior Care/Elderly — calm blue + reassuring green
**Typography:** Medical Clean — Figtree (headings) + Noto Sans (body)

---

## 1. Design Principles

### Elderly-First Philosophy

Every design decision prioritizes the needs of users aged 65+. When there is a conflict between aesthetics and usability, usability wins unconditionally.

### Core Principles

| Principle | Description |
|---|---|
| **Voice-First** | Every action is triggerable by voice. Visual UI supplements, never replaces, voice interaction. |
| **Legibility Over Density** | Large text (18px+ body), generous spacing, high contrast. Never sacrifice readability for information density. |
| **Forgiveness** | Every action is undoable. Destructive actions require confirmation dialog. Repeated questions are answered patiently. |
| **Consistency** | Layout never shifts between visits. Navigation is always in the same place. Patterns repeat predictably. No content jumping (reserve space for async content). |
| **Calm Feedback** | Always show loading states (skeleton screens, not spinners). Use gentle animations. No sudden movements, no auto-playing content. |
| **Touch-Friendly** | Minimum 48x48px touch targets (exceeds WCAG 44px minimum). 8px+ gap between targets. Generous spacing to prevent mis-taps. |
| **No Jargon** | "Talk to CARIA" not "Initialize Voice Session". Every label uses plain, familiar language. |
| **Semantic HTML** | Use `<nav>`, `<main>`, `<article>`, `<button>` — never div soup. Screen readers rely on semantics. |

### Accessibility Commitment (WCAG AAA Target)

| Requirement | Standard | CARIA Target |
|---|---|---|
| Normal text contrast | WCAG AA: 4.5:1 | **WCAG AAA: 7:1** |
| Large text contrast (24px+) | WCAG AA: 3:1 | **WCAG AAA: 4.5:1** |
| UI component contrast | WCAG AA: 3:1 | 3:1 minimum |
| Touch targets | WCAG: 44x44px | **48x48px** |
| Focus indicators | Visible | **3-4px focus ring with glow** |
| Color independence | Required | **Icon + text + color always** |
| Reduced motion | Respect preference | **All animation disabled** |
| Screen reader | Compatible | **Full ARIA + semantic HTML** |
| Keyboard navigation | Full support | **Logical tab order + skip links** |
| Dark mode | Optional | **No dark mode** (light only for aging eyes) |

### Anti-Patterns to Avoid

From UI/UX Pro Max guidelines — these are **never allowed** in CARIA:

- Small text below 14px
- Complex multi-level navigation
- AI-style purple/pink gradients
- Icon-only buttons without text labels
- Placeholder-only form inputs (always use `<label>`)
- Emoji as UI icons (use Lucide SVG icons)
- Layout shift when content loads
- `transition-all` (always transition specific properties)
- `outline-none` without visible focus replacement
- Horizontal scrolling on any viewport
- Auto-playing video or continuous decorative animations
- Zoom-disabling viewport meta (`maximum-scale=1`)

---

## 2. Color Palette

### Design Rationale

**Source:** UI/UX Pro Max — Senior Care/Elderly palette (#60 in colors database).

"Calm blue + reassuring green" — research-backed for elderly care. Blue conveys trust and stability. Green conveys health and reassurance. The combination avoids the anxiety-inducing effects of warm reds and the alienation of tech-purple.

All text-on-background combinations meet **WCAG AAA** (7:1) for normal text.

### Primary Colors (Calm Blue — Trust & Stability)

| Token | Hex | RGB | Usage | vs #FFFFFF | vs #F0F9FF |
|---|---|---|---|---|---|
| `primary-50` | `#F0F9FF` | 240, 249, 255 | Page background | 1.07:1 | — |
| `primary-100` | `#E0F2FE` | 224, 242, 254 | Surface tint, hover fill | 1.13:1 | 1.06:1 |
| `primary-200` | `#BAE6FD` | 186, 230, 253 | Light borders, decorative | 1.39:1 | 1.30:1 |
| `primary-300` | `#7DD3FC` | 125, 211, 252 | Focus ring fill, borders | 1.87:1 | 1.75:1 |
| `primary-400` | `#38BDF8` | 56, 189, 248 | Decorative highlights | 2.66:1 | 2.49:1 |
| `primary-500` | `#0EA5E9` | 14, 165, 233 | Large text hover, icons | 3.44:1 | 3.22:1 |
| `primary-600` | `#0284C7` | 2, 132, 199 | Interactive elements, links | 4.62:1 | 4.32:1 |
| `primary-700` | `#0369A1` | 3, 105, 161 | **Primary buttons, active nav** | 6.08:1 | 5.69:1 |
| `primary-800` | `#075985` | 7, 89, 133 | Headings, emphasis | 7.88:1 | 7.38:1 |
| `primary-900` | `#0C4A6E` | 12, 74, 110 | **Body text on light backgrounds** | 9.72:1 | 9.10:1 |

### Accent Colors (Reassuring Green — Health & Confirmation)

| Token | Hex | RGB | Usage | vs #FFFFFF |
|---|---|---|---|---|
| `accent-50` | `#F0FDF4` | 240, 253, 244 | Success surface | 1.05:1 |
| `accent-100` | `#DCFCE7` | 220, 252, 231 | Success background | 1.14:1 |
| `accent-200` | `#BBF7D0` | 187, 247, 208 | Light green decorative | 1.29:1 |
| `accent-300` | `#86EFAC` | 134, 239, 172 | Decorative | 1.61:1 |
| `accent-400` | `#4ADE80` | 74, 222, 128 | Success icons (large) | 2.11:1 |
| `accent-500` | `#22C55E` | 34, 197, 94 | Decorative only (fails AA with white text) | 2.76:1 |
| `accent-600` | `#16A34A` | 22, 163, 74 | CTA hover, large text | 3.86:1 |
| `accent-700` | `#15803D` | 21, 128, 61 | Success text, taken status | 5.21:1 |
| `accent-800` | `#166534` | 22, 101, 52 | Dark green text | 7.08:1 |
| `accent-900` | `#14532D` | 20, 83, 45 | Strongest green text | 8.81:1 |

### Warm Neutral (Companion Warmth)

For the care companion personality — soft warmth that feels human, not clinical.

| Token | Hex | RGB | Usage | vs #FFFFFF |
|---|---|---|---|---|
| `warm-50` | `#FFFBEB` | 255, 251, 235 | Warm surface tint | 1.03:1 |
| `warm-100` | `#FEF3C7` | 254, 243, 199 | Warm background | 1.10:1 |
| `warm-200` | `#FDE68A` | 253, 230, 138 | Decorative warm | 1.29:1 |
| `warm-300` | `#FCD34D` | 252, 211, 77 | Warm accents | 1.57:1 |
| `warm-400` | `#FBBF24` | 251, 191, 36 | Companion icon accent | 1.97:1 |
| `warm-500` | `#F59E0B` | 245, 158, 11 | Warm highlights | 2.61:1 |
| `warm-600` | `#D97706` | 217, 119, 6 | Warm text (large only) | 3.61:1 |
| `warm-700` | `#B45309` | 180, 83, 9 | Warning text, warm labels | 5.06:1 |
| `warm-800` | `#92400E` | 146, 64, 14 | Dark warm accent | 6.79:1 |
| `warm-900` | `#78350F` | 120, 53, 15 | Strongest warm text | 8.17:1 |

### Semantic Colors

| Token | Hex | Usage | vs #FFFFFF | Safe For |
|---|---|---|---|---|
| `success-700` | `#15803D` | Success text | 5.21:1 | AAA large |
| `success-600` | `#16A34A` | Success icons, badges | 3.86:1 | Large text |
| `success-100` | `#DCFCE7` | Success background | 1.14:1 | Background |
| `success-50` | `#F0FDF4` | Success surface | 1.05:1 | Background |
| `warning-700` | `#B45309` | Warning text | 5.06:1 | AAA large |
| `warning-600` | `#D97706` | Warning icons | 3.61:1 | Large text |
| `warning-100` | `#FEF3C7` | Warning background | 1.10:1 | Background |
| `warning-50` | `#FFFBEB` | Warning surface | 1.03:1 | Background |
| `error-700` | `#B91C1C` | Error text, danger | 5.74:1 | AAA large |
| `error-600` | `#DC2626` | Error icons, badges | 4.63:1 | Large text |
| `error-100` | `#FEE2E2` | Error background | 1.16:1 | Background |
| `error-50` | `#FEF2F2` | Error surface | 1.06:1 | Background |
| `info-700` | `#0369A1` | Info text (= primary) | 6.08:1 | AAA large |
| `info-600` | `#0284C7` | Info icons | 4.62:1 | Large text |
| `info-100` | `#E0F2FE` | Info background | 1.13:1 | Background |
| `info-50` | `#F0F9FF` | Info surface (= page bg) | 1.07:1 | Background |

### Alert Severity Colors

| Severity | Background | Border | Icon/Text | Usage |
|---|---|---|---|---|
| **Low** | `info-50` (#F0F9FF) | `primary-600` (#0284C7) | `primary-900` (#0C4A6E) | Informational, routine |
| **Medium** | `warning-50` (#FFFBEB) | `warm-600` (#D97706) | `warm-700` (#B45309) | Needs attention |
| **High** | `error-50` (#FEF2F2) | `error-600` (#DC2626) | `error-700` (#B91C1C) | Urgent, immediate action |

### Background & Surface Colors

| Token | Hex | Usage |
|---|---|---|
| `bg-page` | `#F0F9FF` | Main page background (primary-50, calm blue tint) |
| `bg-surface` | `#FFFFFF` | Cards, elevated surfaces |
| `bg-surface-alt` | `#F8FAFC` | Secondary surface, alternate rows |
| `bg-muted` | `#E2E8F0` | Disabled backgrounds, skeletons |
| `bg-overlay` | `rgba(12,74,110,0.5)` | Modal overlay backdrop (primary-900 based) |
| `border-default` | `#CBD5E1` | Card borders, dividers |
| `border-strong` | `#94A3B8` | Input borders, active states |
| `border-focus` | `#0369A1` | Focus ring color (primary-700) |

### Text Colors

| Token | Hex | vs #F0F9FF | vs #FFFFFF | Usage |
|---|---|---|---|---|
| `text-primary` | `#0C4A6E` | 9.10:1 AAA | 9.72:1 AAA | Body text, primary content |
| `text-heading` | `#075985` | 7.38:1 AAA | 7.88:1 AAA | Headings |
| `text-secondary` | `#334155` | 8.27:1 AAA | 8.83:1 AAA | Secondary text, descriptions |
| `text-muted` | `#64748B` | 4.27:1 | 4.56:1 | Captions, timestamps (large text) |
| `text-on-primary` | `#FFFFFF` | — | — | Text on primary-700 buttons |
| `text-on-accent` | `#FFFFFF` | — | — | Text on accent-700+ CTA buttons |

---

## 3. Typography

### Font Pairing: Medical Clean

**Source:** UI/UX Pro Max typography database (#30 — "Medical Clean").

| Role | Font | Weights | Reason |
|---|---|---|---|
| **Headings** | Figtree | 400, 500, 600, 700 | Open, friendly letterforms. Designed for clarity. Approachable without being childish. |
| **Body** | Noto Sans | 400, 500, 600, 700 | Universal readability across scripts. Clean letterforms. Excellent at small sizes. |
| **Fallback** | System sans-serif stack | — | `-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif` |

**Alternative considered:** Atkinson Hyperlegible (designed by Braille Institute for visual impairments) — excellent for accessibility-critical content but limited to weights 400/700. Keep as reference for body text if dyslexia-friendly mode is needed.

### Next.js Font Loading

Use `next/font/google` for zero-layout-shift, self-hosted fonts:

```typescript
// src/app/layout.tsx
import { Figtree, Noto_Sans } from 'next/font/google';

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

// Apply to <body>:
// className={`${figtree.variable} ${notoSans.variable} font-body`}
```

### Type Scale

| Token | Size (px) | Size (rem) | Line Height | Letter Spacing | Weight | Font | Tailwind Class | Usage |
|---|---|---|---|---|---|---|---|---|
| `display` | 40px | 2.5rem | 1.2 | -0.02em | 700 | Figtree | `text-display` | Hero text, splash screen |
| `h1` | 32px | 2rem | 1.3 | -0.01em | 700 | Figtree | `text-h1` | Page titles |
| `h2` | 28px | 1.75rem | 1.3 | -0.01em | 600 | Figtree | `text-h2` | Section headings |
| `h3` | 24px | 1.5rem | 1.35 | 0em | 600 | Figtree | `text-h3` | Card titles, subsections |
| `h4` | 20px | 1.25rem | 1.4 | 0em | 600 | Figtree | `text-h4` | Component headings |
| `body-lg` | 20px | 1.25rem | 1.6 | 0.01em | 400 | Noto Sans | `text-body-lg` | Large body text, key info |
| `body` | 18px | 1.125rem | 1.6 | 0.01em | 400 | Noto Sans | `text-body` | **Default body text** |
| `body-sm` | 16px | 1rem | 1.6 | 0.01em | 400 | Noto Sans | `text-body-sm` | Secondary body text |
| `caption` | 14px | 0.875rem | 1.5 | 0.02em | 400 | Noto Sans | `text-caption` | Timestamps, labels (absolute minimum) |

### Font Weights

| Weight | Value | Usage |
|---|---|---|
| Regular | 400 | Body text, descriptions |
| Medium | 500 | Labels, navigation items, nav icon text |
| Semibold | 600 | Headings (h2-h4), buttons, badges |
| Bold | 700 | Display, h1, strong emphasis |

### Typography Rules

1. **Minimum body text is 18px** — never smaller for primary content
2. **14px is the absolute minimum** — only for timestamps and captions
3. **Line height 1.6** for body text — extra spacing aids elderly reading
4. **Left-aligned only** — never center or justify body text blocks
5. **Maximum line length: 65 characters** — `max-w-prose` in Tailwind
6. **Sentence case for UI labels** — easier to read than ALL CAPS or Title Case
7. **Use `font-display: swap`** — prevent invisible text while fonts load (handled by next/font)
8. **Reserve space with fallback font** — prevent layout shift (handled by next/font)

---

## 4. Spacing & Layout

### Base Grid

8px base grid. All spacing values are multiples of 4 or 8.

### Spacing Scale

| Token | Value | Tailwind | Usage |
|---|---|---|---|
| `space-1` | 4px | `p-1` / `m-1` | Minimal internal spacing |
| `space-2` | 8px | `p-2` / `m-2` | Icon-to-text gaps, touch target padding |
| `space-3` | 12px | `p-3` / `m-3` | Tight component padding |
| `space-4` | 16px | `p-4` / `m-4` | Minimum comfortable padding, mobile page edge |
| `space-5` | 20px | `p-5` / `m-5` | Standard gap |
| `space-6` | 24px | `p-6` / `m-6` | **Card padding**, section gaps, tablet page edge |
| `space-8` | 32px | `p-8` / `m-8` | Section separation |
| `space-10` | 40px | `p-10` / `m-10` | Major section spacing |
| `space-12` | 48px | `p-12` / `m-12` | Page section spacing |
| `space-16` | 64px | `p-16` / `m-16` | Extra large spacing |
| `space-20` | 80px | `p-20` / `m-20` | Bottom nav height equivalent |

### Layout Constraints

| Property | Value | Notes |
|---|---|---|
| Max content width | 768px | `max-w-3xl` — focused reading, centered |
| Card padding | 24px minimum | `p-6` at minimum |
| Section vertical spacing | 32–48px | `space-y-8` to `space-y-12` |
| Bottom navigation height | 80px | Extra tall for elderly touch targets |
| Page bottom padding | 96px | 80px nav + 16px safety |
| Touch target minimum | 48x48px | `min-h-[48px] min-w-[48px]` |
| Gap between touch targets | 8px minimum | `gap-2` minimum between interactive elements |
| Border radius (cards) | 16px | `rounded-2xl` — soft, friendly |
| Border radius (buttons) | 12px | `rounded-xl` |
| Border radius (inputs) | 10px | `rounded-[10px]` |

### Z-Index Scale

Per UI/UX Pro Max: define a consistent z-index system, never use arbitrary values.

| Layer | Z-Index | Tailwind | Usage |
|---|---|---|---|
| Base | 0 | `z-0` | Default content |
| Elevated | 10 | `z-10` | Cards with elevation, dropdowns |
| Sticky | 20 | `z-20` | Sticky headers |
| Bottom nav | 30 | `z-30` | Fixed bottom navigation |
| Overlay | 40 | `z-40` | Modal backdrop |
| Modal | 50 | `z-50` | Modal dialog, toast notifications |

### Box Shadows

Gentle shadows using primary-900 tint — never harsh pure-black shadows.

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 3px rgba(12,74,110,0.08)` | Subtle lift |
| `shadow-md` | `0 4px 12px rgba(12,74,110,0.1)` | Cards, elevated surfaces |
| `shadow-lg` | `0 8px 24px rgba(12,74,110,0.12)` | Modals, popovers |
| `shadow-glow` | `0 0 0 4px rgba(3,105,161,0.2)` | Focus ring glow (primary-700) |

---

## 5. Component Specifications

> Full component API with Tailwind class strings is in [components.md](./components.md).

### Component Summary

| Component | Variants | Sizes | Key Accessibility |
|---|---|---|---|
| **Button** | primary, secondary, ghost, danger | lg (default), xl | Min 48px height, `aria-label`, loading state with `aria-busy` |
| **Card** | elevated, outlined | — | Semantic `<article>`/`<section>`, `role="button"` if interactive, `cursor-pointer` |
| **Input** | text, email, password | lg (default) | Visible `<label>`, `aria-describedby` for errors, `autocomplete` attribute |
| **Modal** | centered | max 480px | Focus trap, Escape to close, `aria-modal`, return focus on close |
| **Alert/Toast** | info, success, warning, error | — | `role="alert"`, `aria-live`, icon + text (never color-only) |
| **Badge** | severity, status | sm, md | Meaningful text label always present |
| **LoadingSkeleton** | — | — | `aria-busy="true"`, `aria-label="Loading"`, aspect-ratio reserved |
| **Avatar** | — | md, lg, xl | `alt` text, status indicator with `aria-label` |
| **BottomNav** | 3 items | 80px height | `<nav aria-label>`, `aria-current="page"`, icon + text always |
| **StatusIndicator** | listening, thinking, speaking, idle | — | `aria-live="polite"`, always includes text label |
| **AudioVisualizer** | — | — | `role="img"` + `aria-label`, `prefers-reduced-motion` support |
| **ScreenshotViewer** | — | — | `alt` text, `role="progressbar"` for progress |
| **ConfirmationPrompt** | — | — | `role="alertdialog"`, focus on cancel (safe default) |
| **MedicationCard** | taken, missed, upcoming | — | `<time>` element, semantic status, icon + text |
| **MemoryChapterCard** | — | — | Image `alt`, `<time>`, keyboard accessible (`Enter`/`Space`) |
| **ReportCard** | daily, weekly | — | Mood text label (not just emoji/color), `<time>` for dates |
| **AlertCard** | low, medium, high | — | Severity announced, icon + text, acknowledge button |
| **EmptyState** | — | — | Decorative illustration `aria-hidden`, helpful message, action CTA |

---

## 6. Iconography

### Icon Library

**Lucide React** — clean, consistent, MIT licensed. Never use emoji as UI icons.

```bash
npm install lucide-react
```

### Icon Sizing

| Context | Size | Tailwind |
|---|---|---|
| Inline with body text | 20px | `w-5 h-5` |
| Standalone (buttons, cards) | 24px | `w-6 h-6` |
| Navigation bar | 28px | `w-7 h-7` |
| Feature icons, empty states | 32px | `w-8 h-8` |
| Hero/splash, voice visualizer | 48px | `w-12 h-12` |

### Icon Rules

1. **Always pair icons with text labels** — never icon-only for elderly users
2. Decorative icons (paired with text): `aria-hidden="true"`
3. Standalone icons (rare): must have `aria-label`
4. Use `strokeWidth={2}` for standard, `strokeWidth={2.5}` for navigation
5. Color inherits from text via `currentColor`
6. Consistent viewBox: 24x24 (Lucide default)

### Core Icon Map

| Function | Lucide Icon | Context |
|---|---|---|
| Talk / Voice | `Mic` | Talk tab, voice activation |
| Memories | `BookOpen` | Memories tab |
| Help / Navigate | `HelpCircle` | Help tab |
| Medication | `Pill` | Medication cards |
| Camera | `Camera` | Camera toggle for medication scan |
| Close | `X` | Modal close, dismiss |
| Check / Confirm | `Check` | Success, taken status |
| Warning | `AlertTriangle` | Medium severity alerts |
| Error | `AlertCircle` | High severity alerts, errors |
| Info | `Info` | Low severity, informational |
| Time | `Clock` | Reminders, timestamps |
| Health / Mood | `Heart` | Mood indicators |
| User | `User` | Profile, avatar fallback |
| Family | `Users` | Family dashboard |
| Settings | `Settings` | Settings page |
| Phone | `Phone` | Emergency contact |
| Loading | `Loader2` | Spinner (rare, prefer skeleton) |

---

## 7. Animation & Motion

### Philosophy

Motion is purposeful and calming. No decoration-only animation. Always respect `prefers-reduced-motion`. Animate 1-2 key elements per view maximum.

### Transition Defaults

```css
/* Standard interaction — transition specific properties, not 'all' */
transition: color, background-color, border-color, box-shadow 200ms ease-in-out;
/* Tailwind: transition-colors duration-200 */
```

### Animation Specifications

| Animation | Duration | Easing | Tailwind | Usage |
|---|---|---|---|---|
| Button hover/press | 150ms | ease-in-out | `transition-colors duration-150` | Color change on interaction |
| Card hover lift | 200ms | ease-in-out | `transition-shadow duration-200` | Subtle shadow enhancement |
| Modal enter | 200ms | ease-out | `animate-modal-in` | Fade + scale from 0.95 |
| Modal exit | 150ms | ease-in | `animate-modal-out` | Fade out |
| Toast enter | 300ms | ease-out | `animate-slide-in` | Slide down from -12px |
| Skeleton pulse | 2000ms | ease-in-out | `animate-skeleton` | Gentle opacity 1 → 0.5 → 1 |
| Voice pulse | 2000ms | ease-in-out | `animate-voice-pulse` | Breathing circle scale 1 → 1.08 |
| Status dot | 1500ms | ease-in-out | `animate-status-pulse` | Opacity 1 → 0.4 → 1 |

### Animation Rules

1. **No parallax** — causes nausea/disorientation for elderly
2. **No auto-playing animations** except loading indicators and voice visualizer
3. **No sudden movements** — all transitions use `ease-out` for enter, `ease-in` for exit
4. **Use `transform` and `opacity` only** — never animate `width`, `height`, `top`, `left`
5. **Hover states must not cause layout shift** — use color/opacity, not scale transforms
6. **Respect `prefers-reduced-motion`:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 8. Page Layouts

### Talk Page (Voice Companion)

```
┌─────────────────────────────────────┐
│  CARIA                   [Settings] │  Header
│─────────────────────────────────────│
│                                     │
│    "Hi Margaret, how are you        │
│     feeling today?"                 │  Status text (CARIA's last message)
│                                     │
│            ╭─────────╮              │
│          ╭─┤         ├─╮            │  Outer: pulsing ring (animate-voice-pulse)
│          │ │  [Mic]  │ │            │  Inner: primary-700 circle
│          │ │  CARIA  │ │            │  Icon + label
│          ╰─┤         ├─╯            │
│            ╰─────────╯              │
│                                     │
│       ● Listening...                │  StatusIndicator (aria-live="polite")
│                                     │
│    ┌──────────┐  ┌──────────┐       │
│    │ [Mic]    │  │ [Camera] │       │  Primary mic (64px) + Camera toggle
│    │ Talk     │  │ Camera   │       │
│    └──────────┘  └──────────┘       │
│                                     │
├─────────────────────────────────────┤
│ [Mic] Talk    [Book] Memories  [?] Help │  BottomNav (80px)
└─────────────────────────────────────┘
```

- Centered layout, single column, max-w-3xl
- Voice visualizer: 192px (mobile) / 224px (tablet) pulsing circle
- Mic button: 64px, primary-700, always visible
- Camera toggle: secondary button, off by default
- Status text: shows CARIA's last message as text (hearing-impaired support)
- Skip link: "Skip to voice controls"

### Memories Page

```
┌─────────────────────────────────────┐
│  My Memories          [Tell a Story]│  Header + CTA
│─────────────────────────────────────│
│                                     │
│  ┌───────────────┐ ┌───────────────┐│
│  │   [thumbnail] │ │   [thumbnail] ││
│  │   Wedding Day │ │   Garden      ││  2-col grid (md+), 1-col (mobile)
│  │   June 1968   │ │   March 2004  ││
│  │   "The most   │ │   "I still    ││  Preview text (line-clamp-3)
│  │    beautiful.."│ │    remember.."││
│  └───────────────┘ └───────────────┘│
│                                     │
│  ┌───────────────┐ ┌───────────────┐│
│  │   [thumbnail] │ │   [thumbnail] ││
│  │   First Home  │ │   Retirement  ││
│  │   Sept 1972   │ │   Dec 2015    ││
│  └───────────────┘ └───────────────┘│
│                                     │
├─────────────────────────────────────┤
│ [Mic] Talk    [Book] Memories  [?] Help │
└─────────────────────────────────────┘
```

- Grid: `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6`
- Each card: MemoryChapterCard component, keyboard accessible
- "Tell a Story" button: primary xl, top-right on desktop, full-width on mobile
- Empty state: friendly message + "Tell CARIA about your favorite memory"

### Help Page (Navigator)

```
┌─────────────────────────────────────┐
│  How can I help?                    │  Header
│─────────────────────────────────────│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [Stethoscope]                   ││
│  │ Book a doctor appointment       ││  Task cards — large, full-width
│  │ Find and book your next visit   ││  Icon + title + description
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [FileText]                      ││
│  │ Check pension status            ││
│  │ View your latest pension info   ││
│  └─────────────────────────────────┘│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [ClipboardList]                 ││
│  │ Read medical report             ││
│  │ Get a simple summary            ││
│  └─────────────────────────────────┘│
│                                     │
│  Or just say "Help me with..."     │  Voice prompt hint
│                                     │
├─────────────────────────────────────┤
│ [Mic] Talk    [Book] Memories  [?] Help │
└─────────────────────────────────────┘
```

- Task cards: full width stack, large touch targets
- When navigator active: ScreenshotViewer appears as overlay
- Confirmation prompts for all sensitive actions (login, form submit)
- Single column layout for clarity

### Family Dashboard

```
┌─────────────────────────────────────┐
│  Margaret's Care        [Sign Out]  │  Header
│─────────────────────────────────────│
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Today's Overview                ││
│  │ Mood: Happy and chatty          ││  Daily overview card
│  │ Medications: 2 of 3 taken       ││
│  │ Last conversation: 2 hours ago  ││
│  └─────────────────────────────────┘│
│                                     │
│  Alerts (1)                         │
│  ┌─────────────────────────────────┐│
│  │ [AlertTriangle] Medium          ││
│  │ Missed afternoon medication     ││  AlertCard with acknowledge
│  │ 2:00 PM today                   ││
│  │ [Acknowledge]                   ││
│  └─────────────────────────────────┘│
│                                     │
│  Reports                            │
│  ┌───────────────┐ ┌───────────────┐│
│  │ Weekly Report │ │ Daily Summary ││  ReportCards in grid
│  │ Feb 21-27     │ │ Today         ││
│  │ Mood: Stable  │ │ 3 convos      ││
│  └───────────────┘ └───────────────┘│
│                                     │
└─────────────────────────────────────┘
```

- No bottom nav (separate portal for family members)
- Overview card always at top
- Alerts sorted by severity (high first)
- Report cards: 2-column grid on tablet

### Auth Pages

```
┌─────────────────────────────────────┐
│                                     │
│              CARIA                  │  Logo
│        Your Care Companion          │  Tagline
│                                     │
│    ┌───────────────────────────┐    │
│    │                           │    │
│    │ Email address             │    │  max-w-[400px] centered
│    │ ┌───────────────────────┐ │    │
│    │ │ you@example.com       │ │    │  Large inputs (52px height)
│    │ └───────────────────────┘ │    │
│    │                           │    │
│    │ Password                  │    │
│    │ ┌───────────────────────┐ │    │
│    │ │ ••••••••              │ │    │
│    │ └───────────────────────┘ │    │
│    │                           │    │
│    │ [     Sign In           ] │    │  Primary button, xl
│    │                           │    │
│    │ ──── or ────              │    │
│    │                           │    │
│    │ [G  Sign in with Google ] │    │  Secondary button
│    │                           │    │
│    └───────────────────────────┘    │
│                                     │
│     I am a:  (o) Elder              │  Role selection
│              ( ) Family member      │  Radio buttons, large
│                                     │
└─────────────────────────────────────┘
```

- Centered layout, no bottom nav
- Large form inputs (52px min-height)
- Radio buttons for role selection (not small toggles)
- "Forgot password" link visible and large

---

## 9. Responsive Strategy

### Approach

Mobile-first CSS, but **tablet is the primary target device** for elderly users (iPads, Samsung tablets).

### Breakpoints

| Breakpoint | Width | Tailwind | Target |
|---|---|---|---|
| Default | < 640px | — | Mobile phones |
| `sm` | 640px+ | `sm:` | Large phones |
| `md` | 768px+ | `md:` | **Tablets (primary target)** |
| `lg` | 1024px+ | `lg:` | Landscape tablets, laptops |

### Responsive Behavior

| Element | Mobile (< 768px) | Tablet (768px+) |
|---|---|---|
| Card grid | 1 column | 2 columns |
| Memory cards | Full width stack | 2-column grid |
| Task cards | Full width stack | Full width (focused reading) |
| Bottom nav | Shown, 80px | Shown, 80px |
| Max content width | 100% - 32px padding | 768px centered |
| Page padding | 16px (px-4) | 24px (px-6) |
| Font scale | **Same** | **Same** |
| Voice visualizer | 192px | 224px |

### Key Rules

1. **Same font sizes across all breakpoints** — never scale down on mobile
2. **Bottom nav on all sizes** — consistent navigation
3. **Single column default, 2-column at `md`** — simple grid logic
4. **Content always centered** when wider than max-width
5. **No horizontal scrolling** — ever. Use `overflow-x-hidden` on body
6. **Use `min-h-dvh`** instead of `min-h-screen` — accounts for mobile browser chrome
7. **Reserve space for async content** — use skeleton screens with `aspect-ratio`
8. **Test at 375px, 768px, 1024px** — minimum responsive verification

---

## 10. Tailwind Configuration

> The full exportable theme object is in [tailwind-theme.ts](./tailwind-theme.ts).

### Integration with Next.js

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';
import { cariaTheme } from './docs/design-system/tailwind-theme';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: cariaTheme,
  },
  plugins: [],
};

export default config;
```

### Custom Tokens Summary

| Category | Custom Tokens |
|---|---|
| **Colors** | primary (10), accent (10), warm (10), success, warning, error, info, bg-*, text-*, border-* |
| **Font Family** | `heading` (Figtree), `body` (Noto Sans) via CSS variables |
| **Font Size** | display, h1–h4, body-lg, body, body-sm, caption (with line-height + letter-spacing) |
| **Border Radius** | `card` (16px), `button` (12px), `input` (10px) |
| **Box Shadow** | `sm`, `md`, `lg`, `glow` (all primary-900 tinted) |
| **Animation** | `skeleton`, `voice-pulse`, `status-pulse`, `modal-in`, `modal-out`, `slide-in` |
| **Keyframes** | Matching keyframe definitions for each animation |

---

## 11. Pre-Delivery Checklist

From UI/UX Pro Max methodology — verify before every release:

### Visual Quality
- [ ] No emoji used as UI icons (use Lucide SVG)
- [ ] All icons from Lucide (consistent 24x24 viewBox)
- [ ] Hover states don't cause layout shift
- [ ] All text meets WCAG AAA contrast (7:1 normal, 4.5:1 large)

### Interaction
- [ ] All clickable elements have `cursor-pointer`
- [ ] All interactive elements have visible focus ring (`focus-visible:ring`)
- [ ] Focus ring is never removed without replacement
- [ ] Transitions use specific properties (not `transition-all`)
- [ ] All transitions are 150-300ms

### Accessibility
- [ ] All images have descriptive `alt` text
- [ ] All form inputs have `<label>` elements
- [ ] All icon-only buttons have `aria-label`
- [ ] Color is never the only indicator (icon + text always)
- [ ] `prefers-reduced-motion` respected
- [ ] Skip link present on every page
- [ ] Heading hierarchy is sequential (h1 → h2 → h3)
- [ ] `autocomplete` attribute on all form inputs

### Layout
- [ ] No horizontal scrolling on any viewport
- [ ] Content doesn't hide behind fixed bottom nav (96px bottom padding)
- [ ] Responsive at 375px, 768px, 1024px
- [ ] No content jumping when async content loads
- [ ] Zoom not disabled in viewport meta

---

## Related Files

| File | Description |
|---|---|
| [components.md](./components.md) | Detailed component API specs with Tailwind classes |
| [tailwind-theme.ts](./tailwind-theme.ts) | Exportable Tailwind theme configuration object |
| [color-tokens.md](./color-tokens.md) | Complete color token reference with contrast ratios |
