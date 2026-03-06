# OLAF Component Specifications

Detailed component API specs with Tailwind class strings for each variant and state.

---

## Button

Minimum touch target: 48x48px. Always includes visible text label.

### Variants & Classes

| Variant | Base Classes | Hover | Active | Disabled |
|---|---|---|---|---|
| **primary** | `bg-primary-700 text-white font-semibold rounded-xl shadow-md` | `hover:bg-primary-800` | `active:bg-primary-900 active:shadow-sm` | `disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed disabled:shadow-none` |
| **secondary** | `bg-white text-primary-700 font-semibold rounded-xl border-2 border-primary-300 shadow-sm` | `hover:bg-primary-50 hover:border-primary-400` | `active:bg-primary-100` | `disabled:bg-bg-muted disabled:text-text-muted disabled:border-border-default disabled:cursor-not-allowed` |
| **ghost** | `bg-transparent text-primary-700 font-semibold rounded-xl` | `hover:bg-primary-50` | `active:bg-primary-100` | `disabled:text-text-muted disabled:cursor-not-allowed` |
| **danger** | `bg-error-700 text-white font-semibold rounded-xl shadow-md` | `hover:bg-red-800` | `active:bg-red-900` | `disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed disabled:shadow-none` |

### Sizes

| Size | Classes | Min Height | Notes |
|---|---|---|---|
| **lg** (default) | `px-6 py-3 text-body min-h-[48px]` | 48px | Standard size |
| **xl** | `px-8 py-4 text-body-lg min-h-[56px]` | 56px | Primary CTAs, important actions |

### States

| State | Classes |
|---|---|
| **Focus** | `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300` |
| **Loading** | Add `opacity-80 cursor-wait` + spinner icon before text |

### Full Example

```html
<button class="bg-primary-700 text-white font-semibold rounded-xl shadow-md
               px-6 py-3 text-body min-h-[48px]
               hover:bg-primary-800 active:bg-primary-900 active:shadow-sm
               focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300
               transition-colors duration-150
               disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed"
        type="button">
  Sign In
</button>
```

### Accessibility

- Always use `<button>` element (not div/span)
- Include `aria-label` when button text is ambiguous
- Loading state: add `aria-busy="true"` and `aria-disabled="true"`
- Danger actions: pair with confirmation dialog

---

## Card

Container for grouped content. Always elevated or outlined — never flat.

### Variants

| Variant | Classes |
|---|---|
| **elevated** | `bg-bg-surface rounded-2xl shadow-md p-6` |
| **outlined** | `bg-bg-surface rounded-2xl border border-border-default p-6` |

### Optional Sections

| Section | Classes |
|---|---|
| **Header** | `pb-4 border-b border-border-default mb-4` |
| **Footer** | `pt-4 border-t border-border-default mt-4` |
| **Thumbnail** | `rounded-xl overflow-hidden mb-4` (image container) |
| **Interactive** | Add `cursor-pointer hover:shadow-lg transition-shadow duration-200` |

### Full Example

```html
<article class="bg-bg-surface rounded-2xl shadow-md p-6">
  <div class="pb-4 border-b border-border-default mb-4">
    <h3 class="text-h3 text-text-heading font-semibold">Card Title</h3>
  </div>
  <p class="text-body text-text-primary leading-relaxed">
    Card content goes here.
  </p>
  <div class="pt-4 border-t border-border-default mt-4 flex gap-3">
    <button class="...">Action</button>
  </div>
</article>
```

### Accessibility

- Use `<article>` for standalone cards, `<section>` for grouped
- Include heading element for card title
- Interactive cards: add `role="button"` and `tabindex="0"`, handle Enter/Space

---

## Input

Large, clear form inputs with visible labels and helpful error messages.

### Base Classes

```
w-full px-4 py-3 text-body text-text-primary
bg-bg-surface border-2 border-border-strong rounded-lg
placeholder:text-text-muted
focus:outline-none focus:border-primary-700 focus:ring-4 focus:ring-primary-300
transition-colors duration-150
min-h-[52px]
```

### Label

```
block text-body font-medium text-text-primary mb-2
```

### States

| State | Border Classes | Notes |
|---|---|---|
| **Default** | `border-border-strong` | Standard gray border |
| **Focus** | `border-primary-700 ring-4 ring-primary-300` | Blue border + glow ring |
| **Error** | `border-error-600 ring-4 ring-error-100` | Red border + red glow |
| **Disabled** | `bg-bg-muted border-border-default text-text-muted cursor-not-allowed` | Grayed out |

### Error Message

```
mt-2 text-caption text-error-700 flex items-center gap-1.5
```

### Helper Text

```
mt-2 text-caption text-text-muted
```

### Full Example

```html
<div>
  <label for="email" class="block text-body font-medium text-text-primary mb-2">
    Email address
  </label>
  <input
    id="email"
    type="email"
    class="w-full px-4 py-3 text-body text-text-primary
           bg-bg-surface border-2 border-border-strong rounded-lg
           placeholder:text-text-muted
           focus:outline-none focus:border-primary-700 focus:ring-4 focus:ring-primary-300
           transition-colors duration-150 min-h-[52px]"
    placeholder="you@example.com"
    aria-describedby="email-error"
  />
  <p id="email-error" class="mt-2 text-caption text-error-700 flex items-center gap-1.5" role="alert">
    <AlertCircle class="w-4 h-4" aria-hidden="true" />
    Please enter a valid email address
  </p>
</div>
```

### Accessibility

- Always use `<label>` with `for` attribute matching `id`
- Error messages: `role="alert"` + `aria-describedby` on input
- Never use placeholder as label replacement
- Password inputs: include show/hide toggle with `aria-label`

---

## Modal / Dialog

Centered overlay for confirmations and focused tasks.

### Container

```
fixed inset-0 z-50 flex items-center justify-center p-4
```

### Backdrop

```
fixed inset-0 bg-overlay
```

(`bg-overlay` = `rgba(27,58,75,0.5)`)

### Dialog Panel

```
relative bg-bg-surface rounded-2xl shadow-lg
w-full max-w-[480px] p-6
animate-modal-in
```

### Close Button (top-right)

```
absolute top-4 right-4
p-2 rounded-xl text-text-secondary hover:bg-bg-surface-secondary
focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300
min-w-[44px] min-h-[44px] flex items-center justify-center
```

### Full Example

```html
<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="fixed inset-0 bg-overlay" aria-hidden="true"></div>
  <div class="relative bg-bg-surface rounded-2xl shadow-lg w-full max-w-[480px] p-6 animate-modal-in">
    <button class="absolute top-4 right-4 p-2 rounded-xl text-text-secondary hover:bg-bg-surface-secondary min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Close">
      <X class="w-6 h-6" />
    </button>
    <h2 id="modal-title" class="text-h3 text-text-heading font-semibold mb-4">Confirm Action</h2>
    <p class="text-body text-text-primary mb-6">Are you sure you want to proceed?</p>
    <div class="flex gap-3">
      <button class="flex-1 ...secondary-button-classes...">Cancel</button>
      <button class="flex-1 ...primary-button-classes...">Confirm</button>
    </div>
  </div>
</div>
```

### Accessibility

- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` pointing to title element
- Focus trap: first focusable element on open, cycle within dialog
- Escape key closes dialog
- Return focus to trigger element on close

---

## Alert / Toast

Informational messages with optional action.

### Variants

| Variant | Container Classes | Icon Color | Text Color |
|---|---|---|---|
| **info** | `bg-info-50 border border-info-600` | `text-info-700` | `text-info-700` |
| **success** | `bg-success-50 border border-success-600` | `text-success-700` | `text-success-700` |
| **warning** | `bg-warning-50 border border-warning-600` | `text-warning-700` | `text-warning-700` |
| **error** | `bg-error-50 border border-error-600` | `text-error-700` | `text-error-700` |

### Structure

```
rounded-xl p-4 flex items-start gap-3
```

### Parts

| Part | Classes |
|---|---|
| **Icon** | `w-6 h-6 flex-shrink-0 mt-0.5` + variant icon color |
| **Title** | `text-body font-semibold` + variant text color |
| **Description** | `text-body-sm text-text-primary mt-1` |
| **Action button** | `mt-3 text-body-sm font-semibold underline` + variant text color |
| **Dismiss** | `ml-auto p-1 rounded-lg hover:bg-black/5 min-w-[36px] min-h-[36px] flex items-center justify-center` |

### Toast (slide-in notification)

```
fixed top-4 right-4 left-4 md:left-auto md:w-[400px] z-50
animate-slide-in
```

### Accessibility

- Container: `role="alert"` for errors/warnings, `role="status"` for info/success
- Include `aria-live="assertive"` for urgent, `aria-live="polite"` for info
- Dismiss button: `aria-label="Dismiss alert"`

---

## Badge

Small status indicators. Always includes text — never color-only.

### Severity Variants

| Variant | Classes |
|---|---|
| **low** | `bg-info-100 text-info-700 border border-info-600` |
| **medium** | `bg-warning-100 text-warning-700 border border-warning-600` |
| **high** | `bg-error-100 text-error-700 border border-error-600` |

### Status Variants

| Variant | Classes |
|---|---|
| **active** | `bg-success-100 text-success-700` |
| **inactive** | `bg-bg-muted text-text-muted` |
| **pending** | `bg-warning-100 text-warning-700` |

### Sizes

| Size | Classes |
|---|---|
| **sm** | `px-2 py-0.5 text-caption font-medium rounded-md` |
| **md** | `px-3 py-1 text-body-sm font-medium rounded-lg` |

---

## Loading Skeleton

Placeholder UI while content loads.

### Base Classes

```
bg-bg-muted rounded-xl animate-skeleton
```

### Shapes

| Shape | Classes | Usage |
|---|---|---|
| **Text line** | `h-4 rounded-md` | Body text placeholder |
| **Heading** | `h-7 w-3/4 rounded-md` | Heading placeholder |
| **Card** | `h-48 rounded-2xl` | Full card placeholder |
| **Avatar** | `rounded-full` (+ size) | Avatar placeholder |
| **Thumbnail** | `aspect-[4/3] rounded-xl` | Image placeholder |

### Accessibility

- Wrap in container with `aria-busy="true"` and `aria-label="Loading content"`
- Use `role="status"` on the skeleton wrapper

---

## Avatar

User profile images with optional status indicator.

### Sizes

| Size | Classes | Pixel Size |
|---|---|---|
| **md** | `w-10 h-10 rounded-full` | 40px |
| **lg** | `w-14 h-14 rounded-full` | 56px |
| **xl** | `w-20 h-20 rounded-full` | 80px |

### Fallback (no image)

```
bg-primary-200 text-primary-700 flex items-center justify-center font-semibold
```

Display initials: `text-body` for md, `text-h3` for lg, `text-h2` for xl.

### Status Indicator

```
absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-bg-surface
```

| Status | Color Class |
|---|---|
| Online | `bg-success-600` |
| Away | `bg-warning-600` |
| Offline | `bg-bg-muted` |

### Accessibility

- Image: `alt="[Name]'s profile photo"`
- Fallback: `aria-label="[Name]"`
- Status: `aria-label="Status: online"` on the indicator dot

---

## Bottom Navigation

Fixed bottom bar with 3 items. 80px tall for easy elderly touch.

### Container

```
fixed bottom-0 left-0 right-0 h-20 bg-bg-surface border-t border-border-default
flex items-center justify-around px-4
z-40
safe-area-inset-bottom
```

### Nav Item

| State | Classes |
|---|---|
| **Inactive** | `flex flex-col items-center gap-1 py-2 px-4 text-text-muted min-w-[72px] min-h-[56px]` |
| **Active** | `flex flex-col items-center gap-1 py-2 px-4 text-primary-700 font-medium min-w-[72px] min-h-[56px]` |

### Icon + Label

```
Icon: w-7 h-7 (28px)
Label: text-caption font-medium
```

### Items

| Item | Icon | Label |
|---|---|---|
| 1 | `Mic` | Talk |
| 2 | `BookOpen` | Memories |
| 3 | `HelpCircle` | Help |

### Accessibility

- `<nav>` element with `aria-label="Main navigation"`
- Each item: `aria-current="page"` when active
- Always show both icon and text label
- Focus indicator: `focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-xl`

---

## Status Indicator

Visual indicator for voice companion state.

### States

| State | Dot Color | Animation | Label |
|---|---|---|---|
| **listening** | `bg-success-600` | `animate-status-pulse` | "Listening..." |
| **thinking** | `bg-warning-600` | `animate-status-pulse` | "Thinking..." |
| **speaking** | `bg-primary-600` | `animate-status-pulse` | "Speaking..." |
| **idle** | `bg-bg-muted` | none | "Ready" |

### Classes

```
flex items-center gap-2

Dot: w-3 h-3 rounded-full [color] [animation]
Label: text-body-sm text-text-secondary
```

### Accessibility

- Wrap in `<div aria-live="polite">` so state changes are announced
- Include text label — never dot-only

---

## Audio Visualizer

Pulsing circle representing OLAF's voice companion.

### Container

```
relative flex items-center justify-center
w-48 h-48 md:w-56 md:h-56
```

### Circle (outer, pulsing)

```
absolute inset-0 rounded-full bg-primary-200 animate-voice-pulse
```

### Circle (inner, stable)

```
relative w-32 h-32 md:w-40 md:h-40 rounded-full
bg-primary-700 text-white
flex flex-col items-center justify-center gap-2
shadow-lg
```

### Inner Content

```
Icon: w-8 h-8 (Mic icon when listening, Volume2 when speaking)
Label: text-body-sm font-medium
```

### Accessibility

- `aria-label="OLAF voice companion - [state]"`
- `role="img"` on the visualizer
- Respect `prefers-reduced-motion`: replace animation with static ring

---

## Screenshot Viewer

Navigator agent screenshot display with action overlay.

### Container

```
relative bg-bg-surface rounded-2xl overflow-hidden shadow-lg
border border-border-default
```

### Screenshot Image

```
w-full aspect-video object-contain bg-black/5
```

### Action Overlay

```
absolute bottom-0 left-0 right-0
bg-gradient-to-t from-black/70 to-transparent
p-4 pt-8
```

### Progress Bar

```
w-full h-2 bg-bg-muted rounded-full overflow-hidden mb-3

Progress fill: h-full bg-primary-600 rounded-full transition-all duration-500
```

### Status Text (in overlay)

```
text-body-sm text-white font-medium
```

### Accessibility

- `alt` text describing the current screenshot content
- Progress bar: `role="progressbar" aria-valuenow aria-valuemin aria-valuemax`
- Action descriptions read by screen reader

---

## Confirmation Prompt

Large yes/no prompt for navigator sensitive actions.

### Container

```
bg-bg-surface rounded-2xl shadow-lg p-6 max-w-[480px] w-full
```

### Message

```
text-body-lg text-text-primary text-center mb-6 leading-relaxed
```

### Button Row

```
flex gap-4

Each button: flex-1
```

### Button Specs

| Action | Classes |
|---|---|
| **Yes / Confirm** | Primary button, xl size |
| **No / Cancel** | Secondary button, xl size |

### Accessibility

- Focus on the **cancel** button by default (safe default)
- Clear, plain-language action descriptions
- `role="alertdialog"` with `aria-describedby` pointing to message

---

## Medication Card

Displays medication info with status.

### Container

```
bg-bg-surface rounded-2xl border border-border-default p-5 flex items-center gap-4
```

### Icon Area

| Status | Classes |
|---|---|
| **upcoming** | `w-12 h-12 rounded-xl bg-info-50 text-info-700 flex items-center justify-center` |
| **taken** | `w-12 h-12 rounded-xl bg-success-50 text-success-700 flex items-center justify-center` |
| **missed** | `w-12 h-12 rounded-xl bg-error-50 text-error-700 flex items-center justify-center` |

### Content Area

```
flex-1 min-w-0
```

| Part | Classes |
|---|---|
| **Name** | `text-body font-semibold text-text-heading truncate` |
| **Dosage** | `text-body-sm text-text-secondary mt-0.5` |
| **Time** | `text-caption text-text-muted mt-1 flex items-center gap-1` (with Clock icon) |

### Status Badge

```
flex-shrink-0
```

Use Badge component with appropriate status variant.

### Accessibility

- Wrap in `<article>` with `aria-label="[Medication name] - [status]"`
- Time: use `<time>` element with `datetime` attribute
- Status communicated via text, not color alone

---

## Memory Chapter Card

Thumbnail card for memory stories.

### Container

```
bg-bg-surface rounded-2xl shadow-md overflow-hidden
cursor-pointer hover:shadow-lg transition-shadow duration-200
focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300
```

### Thumbnail

```
aspect-[4/3] w-full object-cover bg-bg-muted
```

### Content

```
p-5
```

| Part | Classes |
|---|---|
| **Title** | `text-h4 font-semibold text-text-heading line-clamp-2` |
| **Date** | `text-caption text-text-muted mt-1` |
| **Preview** | `text-body-sm text-text-secondary mt-2 line-clamp-3` |

### Accessibility

- `role="button"` with `tabindex="0"` (if clickable)
- Handle Enter/Space key press
- Image: `alt` describing the illustration
- Date: `<time>` element

---

## Report Card

Daily or weekly report summary.

### Container

```
bg-bg-surface rounded-2xl shadow-md p-6
```

### Header

```
flex items-center justify-between mb-4
```

| Part | Classes |
|---|---|
| **Type badge** | Badge component (`daily` = info, `weekly` = primary) |
| **Date range** | `text-caption text-text-muted` |

### Mood Indicator

```
flex items-center gap-2 mb-3
```

| Mood | Emoji | Color |
|---|---|---|
| Happy | (displayed as text) | `text-success-700` |
| Okay | (displayed as text) | `text-info-700` |
| Sad | (displayed as text) | `text-warning-700` |
| Anxious | (displayed as text) | `text-error-700` |

### Summary

```
text-body text-text-primary leading-relaxed
```

### Accessibility

- Mood communicated via text label, not emoji alone
- Report title describes type and date range
- Summary is readable content, not truncated

---

## Alert Card

Alert with severity indicator, timestamp, and action.

### Container

| Severity | Classes |
|---|---|
| **low** | `bg-info-50 border-l-4 border-info-600 rounded-xl p-5` |
| **medium** | `bg-warning-50 border-l-4 border-warning-600 rounded-xl p-5` |
| **high** | `bg-error-50 border-l-4 border-error-600 rounded-xl p-5` |

### Content Layout

```
flex items-start gap-3
```

| Part | Classes |
|---|---|
| **Icon** | `w-6 h-6 flex-shrink-0 mt-0.5` + severity color |
| **Title** | `text-body font-semibold` + severity text color |
| **Message** | `text-body-sm text-text-primary mt-1` |
| **Timestamp** | `text-caption text-text-muted mt-2` |
| **Acknowledge** | Primary button, lg size, `mt-3` |

### Severity Icons

| Severity | Icon |
|---|---|
| low | `Info` |
| medium | `AlertTriangle` |
| high | `AlertCircle` |

### Accessibility

- `role="alert"` for high severity
- `role="status"` for low/medium
- Severity badge with text label
- Acknowledge button with clear aria-label: "Acknowledge alert: [message summary]"

---

## Empty State

Friendly placeholder when no content exists.

### Container

```
flex flex-col items-center justify-center py-16 px-6 text-center
```

### Parts

| Part | Classes |
|---|---|
| **Illustration area** | `w-24 h-24 mb-6 text-primary-300` (placeholder icon or SVG) |
| **Title** | `text-h3 text-text-heading font-semibold mb-2` |
| **Message** | `text-body text-text-secondary max-w-sm mb-6 leading-relaxed` |
| **Action** | Primary button, lg size |

### Example Messages

| Context | Title | Message | Action |
|---|---|---|---|
| No memories | "No memories yet" | "Tell OLAF about your favorite memory to get started." | "Tell a Story" |
| No alerts | "All clear" | "No alerts to show. That's great news!" | — |
| No reports | "No reports yet" | "Reports will appear here after your first day with OLAF." | — |

### Accessibility

- Title and message are sufficient — illustration is decorative (`aria-hidden="true"`)
- Action button if present should be the primary path forward
