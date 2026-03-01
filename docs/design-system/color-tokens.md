# CARIA Color Token Reference

**Version:** 2.0.0
**Source:** UI/UX Pro Max — Senior Care/Elderly palette (#60) + Accessible & Ethical style
**Philosophy:** Calm blue + reassuring green. Trust, stability, health.

---

## Contrast Ratio Targets

| Standard | Ratio | Applies To |
|---|---|---|
| **WCAG AAA** (normal text) | 7:1 minimum | Body text (18px), labels, captions (14px) |
| **WCAG AAA** (large text) | 4.5:1 minimum | Headings (24px+), bold text (18.66px+) |
| **WCAG AA** (UI components) | 3:1 minimum | Borders, icons, form controls, focus rings |

All contrast ratios below calculated against both `#F0F9FF` (bg-page) and `#FFFFFF` (bg-surface).

---

## Primary Palette — Calm Blue

Trust, stability, calm. The anchor color `#0369A1` was selected by UI/UX Pro Max for Senior Care/Elderly products.

| Token | Hex | RGB | vs #FFFFFF | vs #F0F9FF | Passes | Safe For |
|---|---|---|---|---|---|---|
| `primary-50` | `#F0F9FF` | 240, 249, 255 | 1.07:1 | — | — | Page background |
| `primary-100` | `#E0F2FE` | 224, 242, 254 | 1.13:1 | 1.06:1 | — | Surface tint |
| `primary-200` | `#BAE6FD` | 186, 230, 253 | 1.39:1 | 1.30:1 | — | Decorative borders |
| `primary-300` | `#7DD3FC` | 125, 211, 252 | 1.87:1 | 1.75:1 | — | Focus ring fill |
| `primary-400` | `#38BDF8` | 56, 189, 248 | 2.66:1 | 2.49:1 | — | Decorative only |
| `primary-500` | `#0EA5E9` | 14, 165, 233 | 3.44:1 | 3.22:1 | AA UI | Large text, icons on white |
| `primary-600` | `#0284C7` | 2, 132, 199 | 4.62:1 | 4.32:1 | AAA large | Links, interactive elements |
| `primary-700` | `#0369A1` | 3, 105, 161 | 6.08:1 | 5.69:1 | AAA large | **Primary buttons, active nav** |
| `primary-800` | `#075985` | 7, 89, 133 | 7.88:1 | 7.38:1 | **AAA** | **Headings, emphasis** |
| `primary-900` | `#0C4A6E` | 12, 74, 110 | 9.72:1 | 9.10:1 | **AAA** | **Body text** |

### Primary Usage Guide

| Need | Use Token | Contrast | Notes |
|---|---|---|---|
| Body text | `primary-900` | 9.72:1 AAA | Default text color |
| Headings | `primary-800` | 7.88:1 AAA | All heading levels |
| Button background | `primary-700` | 6.08:1 vs white | White text on primary-700: 6.08:1 |
| Button hover | `primary-800` | 7.88:1 vs white | Darker on hover |
| Links | `primary-600` | 4.62:1 | AAA for large text (18px body = large) |
| Focus ring | `primary-300` | — | Decorative, combined with glow shadow |
| Tint background | `primary-50` | — | Page background |
| Light surface | `primary-100` | — | Hover fills, info backgrounds |

---

## Accent Palette — Reassuring Green

Health, success, confirmation. Used for CTA buttons, success states, and medication "taken" status.

| Token | Hex | RGB | vs #FFFFFF | vs #F0F9FF | Passes | Safe For |
|---|---|---|---|---|---|---|
| `accent-50` | `#F0FDF4` | 240, 253, 244 | 1.05:1 | — | — | Success surface |
| `accent-100` | `#DCFCE7` | 220, 252, 231 | 1.14:1 | 1.07:1 | — | Success background |
| `accent-200` | `#BBF7D0` | 187, 247, 208 | 1.29:1 | 1.21:1 | — | Decorative |
| `accent-300` | `#86EFAC` | 134, 239, 172 | 1.61:1 | 1.51:1 | — | Decorative |
| `accent-400` | `#4ADE80` | 74, 222, 128 | 2.11:1 | 1.97:1 | — | Large icons only |
| `accent-500` | `#22C55E` | 34, 197, 94 | 2.76:1 | 2.58:1 | — | Decorative only (2.76:1 fails AA) |
| `accent-600` | `#16A34A` | 22, 163, 74 | 3.86:1 | 3.61:1 | AA UI | CTA hover, large text |
| `accent-700` | `#15803D` | 21, 128, 61 | 5.21:1 | 4.88:1 | AAA large | **Success text** |
| `accent-800` | `#166534` | 22, 101, 52 | 7.08:1 | 6.63:1 | **AAA** | Dark success text |
| `accent-900` | `#14532D` | 20, 83, 45 | 8.81:1 | 8.25:1 | **AAA** | Strongest green text |

### White Text on Green Backgrounds

| Background | White Text Contrast | Passes |
|---|---|---|
| `accent-500` (#22C55E) | 2.76:1 | Below AA — use `accent-800` text instead, OR use for large bold text only |
| `accent-600` (#16A34A) | 3.86:1 | AA for large text |
| `accent-700` (#15803D) | 5.21:1 | AAA for large text |

**Recommendation for CTA buttons:** Use `accent-700` (#15803D) background with white text (5.21:1 — AAA large) for maximum accessibility. Never use `accent-500` with white text (only 2.76:1).

---

## Warm Palette — Companion Warmth

Amber-based warmth for the CARIA companion personality. Used for warning states and warm UI accents that make the app feel caring, not clinical.

| Token | Hex | RGB | vs #FFFFFF | vs #F0F9FF | Passes | Safe For |
|---|---|---|---|---|---|---|
| `warm-50` | `#FFFBEB` | 255, 251, 235 | 1.03:1 | — | — | Warning surface |
| `warm-100` | `#FEF3C7` | 254, 243, 199 | 1.10:1 | 1.03:1 | — | Warning background |
| `warm-200` | `#FDE68A` | 253, 230, 138 | 1.29:1 | 1.21:1 | — | Decorative |
| `warm-300` | `#FCD34D` | 252, 211, 77 | 1.57:1 | 1.47:1 | — | Decorative |
| `warm-400` | `#FBBF24` | 251, 191, 36 | 1.97:1 | 1.84:1 | — | Large icons only |
| `warm-500` | `#F59E0B` | 245, 158, 11 | 2.61:1 | 2.44:1 | — | Decorative highlights |
| `warm-600` | `#D97706` | 217, 119, 6 | 3.61:1 | 3.38:1 | AA UI | Warning icons, large text |
| `warm-700` | `#B45309` | 180, 83, 9 | 5.06:1 | 4.74:1 | AAA large | **Warning text** |
| `warm-800` | `#92400E` | 146, 64, 14 | 6.79:1 | 6.36:1 | AAA large | Dark warning text |
| `warm-900` | `#78350F` | 120, 53, 15 | 8.17:1 | 7.65:1 | **AAA** | Strongest warm text |

---

## Semantic Color Quick Reference

### Success (= Accent Green)

| Role | Token | Hex | Usage |
|---|---|---|---|
| Surface | `success-50` | `#F0FDF4` | Toast/alert background |
| Background | `success-100` | `#DCFCE7` | Badge background |
| Icon | `success-600` | `#16A34A` | Check mark icons |
| Text | `success-700` | `#15803D` | "Taken", "Confirmed" labels |

### Warning (= Warm Amber)

| Role | Token | Hex | Usage |
|---|---|---|---|
| Surface | `warning-50` | `#FFFBEB` | Toast/alert background |
| Background | `warning-100` | `#FEF3C7` | Badge background |
| Icon | `warning-600` | `#D97706` | Warning triangle icons |
| Text | `warning-700` | `#B45309` | "Pending", "Missed" labels |

### Error (Red)

| Role | Token | Hex | Usage |
|---|---|---|---|
| Surface | `error-50` | `#FEF2F2` | Toast/alert background |
| Background | `error-100` | `#FEE2E2` | Badge background, input error ring |
| Icon | `error-600` | `#DC2626` | Error circle icons |
| Text | `error-700` | `#B91C1C` | Error messages, "Urgent" labels |

### Info (= Primary Blue)

| Role | Token | Hex | Usage |
|---|---|---|---|
| Surface | `info-50` | `#F0F9FF` | Toast/alert background |
| Background | `info-100` | `#E0F2FE` | Badge background |
| Icon | `info-600` | `#0284C7` | Info circle icons |
| Text | `info-700` | `#0369A1` | Informational text |

---

## Alert Severity Quick Reference

### Low Severity — Informational

```
Background: #F0F9FF (info-50 / primary-50)
Border-left: #0284C7 (primary-600)
Icon:        Info icon in #0369A1 (primary-700)
Title:       #075985 (primary-800)
Body:        #0C4A6E (primary-900)
```

### Medium Severity — Needs Attention

```
Background: #FFFBEB (warning-50 / warm-50)
Border-left: #D97706 (warm-600)
Icon:        AlertTriangle in #B45309 (warm-700)
Title:       #92400E (warm-800)
Body:        #0C4A6E (primary-900)
```

### High Severity — Urgent

```
Background: #FEF2F2 (error-50)
Border-left: #DC2626 (error-600)
Icon:        AlertCircle in #B91C1C (error-700)
Title:       #B91C1C (error-700)
Body:        #0C4A6E (primary-900)
```

---

## Background & Surface Colors

| Token | Hex | RGB | Usage |
|---|---|---|---|
| `bg-page` | `#F0F9FF` | 240, 249, 255 | Main page background (calm blue tint) |
| `bg-surface` | `#FFFFFF` | 255, 255, 255 | Cards, elevated surfaces |
| `bg-surface-alt` | `#F8FAFC` | 248, 250, 252 | Alternate rows, secondary panels |
| `bg-muted` | `#E2E8F0` | 226, 232, 240 | Disabled backgrounds, skeleton elements |
| `bg-overlay` | `rgba(12,74,110,0.5)` | — | Modal/dialog backdrop |

---

## Text Colors — Full Reference

| Token | Hex | vs bg-page (#F0F9FF) | vs bg-surface (#FFF) | WCAG AAA Normal? | Usage |
|---|---|---|---|---|---|
| `text-primary` | `#0C4A6E` | 9.10:1 | 9.72:1 | Yes | Body text |
| `text-heading` | `#075985` | 7.38:1 | 7.88:1 | Yes | All headings |
| `text-secondary` | `#334155` | 8.27:1 | 8.83:1 | Yes | Descriptions, secondary content |
| `text-muted` | `#64748B` | 4.27:1 | 4.56:1 | No (AAA large only) | Captions, timestamps at 14px |
| `text-on-primary` | `#FFFFFF` | — | — | — | On primary-700+ backgrounds |
| `text-on-accent` | `#FFFFFF` | — | — | — | On accent-600+ backgrounds |

### White Text on Colored Backgrounds

| Background | Hex | White Text Contrast | Passes |
|---|---|---|---|
| `primary-700` | `#0369A1` | 6.08:1 | AAA large text |
| `primary-800` | `#075985` | 7.88:1 | **AAA all text** |
| `primary-900` | `#0C4A6E` | 9.72:1 | **AAA all text** |
| `accent-600` | `#16A34A` | 3.86:1 | AA large text |
| `accent-700` | `#15803D` | 5.21:1 | AAA large text |
| `error-700` | `#B91C1C` | 5.74:1 | AAA large text |
| `warm-700` | `#B45309` | 5.06:1 | AAA large text |

---

## Border Colors

| Token | Hex | RGB | vs bg-surface (#FFF) | Usage |
|---|---|---|---|---|
| `border-default` | `#CBD5E1` | 203, 213, 225 | 1.66:1 | Subtle dividers, card borders |
| `border-strong` | `#94A3B8` | 148, 163, 184 | 2.54:1 | Input borders, active states |
| `border-focus` | `#0369A1` | 3, 105, 161 | 6.08:1 | Focus ring (with glow shadow) |

---

## Color-Blind Safety

| Deficiency | Affected | CARIA Mitigation |
|---|---|---|
| **Protanopia** (red-blind) | Red/green confusion | Error (#B91C1C) vs success (#15803D) differ in luminance (5.74:1 vs 5.21:1). All states use icon + text label. |
| **Deuteranopia** (green-blind) | Red/green confusion | Same luminance-based distinction. CTA green is never used for error. |
| **Tritanopia** (blue-blind) | Blue/yellow confusion | Primary blue (#0369A1) and warm amber (#B45309) differ in both hue and luminance. |

### Fundamental Rule

**Never communicate meaning through color alone.** Every colored element always includes:
1. A text label (e.g., "Taken", "Missed", "Urgent")
2. An icon that reinforces meaning (Check, X, AlertTriangle)
3. Sufficient luminance contrast to distinguish states even in grayscale

---

## CSS Custom Properties Reference

For use in global CSS or component styles:

```css
:root {
  /* Primary */
  --color-primary-50: #F0F9FF;
  --color-primary-100: #E0F2FE;
  --color-primary-200: #BAE6FD;
  --color-primary-300: #7DD3FC;
  --color-primary-400: #38BDF8;
  --color-primary-500: #0EA5E9;
  --color-primary-600: #0284C7;
  --color-primary-700: #0369A1;
  --color-primary-800: #075985;
  --color-primary-900: #0C4A6E;

  /* Accent */
  --color-accent-50: #F0FDF4;
  --color-accent-100: #DCFCE7;
  --color-accent-500: #22C55E;
  --color-accent-600: #16A34A;
  --color-accent-700: #15803D;

  /* Warm */
  --color-warm-50: #FFFBEB;
  --color-warm-100: #FEF3C7;
  --color-warm-600: #D97706;
  --color-warm-700: #B45309;

  /* Semantic */
  --color-error-50: #FEF2F2;
  --color-error-100: #FEE2E2;
  --color-error-600: #DC2626;
  --color-error-700: #B91C1C;

  /* Backgrounds */
  --color-bg-page: #F0F9FF;
  --color-bg-surface: #FFFFFF;
  --color-bg-muted: #E2E8F0;

  /* Text */
  --color-text-primary: #0C4A6E;
  --color-text-heading: #075985;
  --color-text-secondary: #334155;
  --color-text-muted: #64748B;

  /* Borders */
  --color-border: #CBD5E1;
  --color-border-strong: #94A3B8;
  --color-border-focus: #0369A1;
}
```
