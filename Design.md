# Arkalyn-Kitty Design System

## 1. Brand Essence
Arkalyn-Kitty is a group wallet app for pooled expenses (shared kitty). NOT a debt-tracking app. Members contribute to a pool, expenses deduct from it.

Personality: trustworthy fintech with friendly group-app warmth. Numbers always crystal clear. Whimsy lives in copy and empty states, never in core financial views. Modern, lightweight, fast.

## 2. Color System

### Light Theme
- Background: `#FAFAF9` (neutral-50)
- Surface: `#FFFFFF`
- Surface-elevated: `#FFFFFF` with `shadow-sm`
- Border: `#E7E5E4` (neutral-200)
- Border-strong: `#D6D3D1` (neutral-300)
- Text-primary: `#0C0A09` (neutral-950)
- Text-secondary: `#57534E` (neutral-600)
- Text-tertiary: `#A8A29E` (neutral-400)

### Dark Theme
- Background: `#0C0A09` (neutral-950)
- Surface: `#1C1917` (neutral-900)
- Surface-elevated: `#292524` (neutral-800)
- Border: `#292524` (neutral-800)
- Border-strong: `#44403C` (neutral-700)
- Text-primary: `#FAFAF9`
- Text-secondary: `#A8A29E`
- Text-tertiary: `#78716C`

### Accent Colors (theme-agnostic)
- Primary: `#6366F1` (indigo-500) | hover `#4F46E5` | active `#4338CA`
- Primary-foreground: `#FFFFFF`
- Success: `#10B981` (emerald-500) — credits, contributions, positive balance
- Warning: `#F59E0B` (amber-500) — low pool balance, pending exits
- Danger: `#EF4444` (red-500) — delete, errors
- Info: `#0EA5E9` (sky-500) — notifications

### Semantic Financial Tokens (i18n ready)
- Credit (வரவு): emerald-500
- Debit (செலவு): red-500
- Refund (திரும்பப் பெறுதல்): amber-500
- Balance (இருப்பு): indigo-500

## 3. Typography
- UI font: Inter
- Numerical font: JetBrains Mono (all currency displays use `tabular-nums`)
- Currency format: `₹1,23,456.78` (Indian numbering)

Scale (mobile / desktop):
- Display: 32 / 48px, weight 700, tracking -0.02em
- H1: 24 / 32px, weight 600
- H2: 20 / 24px, weight 600
- H3: 18 / 20px, weight 600
- Body: 14 / 16px, weight 400
- Small: 12 / 14px, weight 400
- Caption: 11 / 12px, weight 500, uppercase, tracking 0.05em

## 4. Spacing & Layout
- Base: 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64
- Container max-width: 1280px
- Breakpoints: mobile 375–767, tablet 768–1023, desktop 1024+

## 5. Components

### Buttons
- Radius: 8px | Heights: 36 (sm), 40 (md), 44 (lg)
- Variants: primary (indigo), secondary (outline), ghost, destructive (red)
- States: default, hover, active, focus (ring-2 indigo/40), disabled (50% opacity)
- Loading: spinner replaces text, width preserved

### Cards
- Radius: 12px | Padding: 16px mobile / 20px desktop
- Border: 1px solid border | Shadow: sm default, md on hover (interactive)

### Inputs
- Radius: 8px | Height: 40px
- Focus: 1px primary border | Error: 1px danger border
- Label above (caption style), helper/error below
- Currency inputs: mono font, ₹ prefix, comma separators

### Modals
- Radius: 16px | Backdrop: black/40 + backdrop-blur-sm
- Max-widths: 480 (action), 640 (form), 800 (detail)
- Mobile: bottom-sheet, slide-up, visible drag handle

### Toasts
- Position: top-right desktop, top-center mobile
- Auto-dismiss: 4s success, 6s error

### Avatars
- Sizes: 24, 32, 40, 56px | Full radius
- Fallback: initials on neutral-200 (light) / neutral-700 (dark)

### Charts
- Color cycle: indigo, emerald, amber, sky, rose, violet, teal, orange
- Grid: border color, dashed
- Tooltip: surface-elevated, shadow-md, 8px radius

### Empty States
- Centered line-art illustration (max 240px), primary stroke, no fill
- Heading + 1-line subtext + primary CTA

### Skeleton Loaders
- Bg: neutral-200 light / neutral-800 dark
- Shimmer animation, 1.5s loop, left-to-right
- Match final layout exactly. No spinners on data pages.

### Confirmation Modals
- Standard: "Are you sure?" + Cancel / Confirm
- High-stakes (delete group, delete account): typed-name verification field

## 6. Iconography
- Lucide React | 1.5px stroke | 16/20/24px sizes | inherits text-primary

## 7. Motion
- 150ms micro / 200ms transitions / 300ms modals
- Ease-out for enters, ease-in for exits
- Respect `prefers-reduced-motion`

## 8. Accessibility
- Min 44px tap targets on mobile
- Focus rings always visible
- Contrast: AA minimum (4.5:1 body, 3:1 large)
- All form fields have explicit labels (no placeholder-only)
- Currency announcements: `aria-label="₹500 credit"`
- i18n: English + Tamil. Layouts must accommodate ~1.3x string length.

## 9. Voice & Tone
- Concise, direct, no preaching
- Empty states can be playful: "Your kitty is empty — let's fund it"
- Confirmations on money/destructive actions are plain and clear, never cute
- Errors blame the system, never the user
- Tamil financial terms (வரவு/செலவு/இருப்பு) used consistently across languages

## 10. Required States (every page)
1. Skeleton loader — matches final layout
2. Empty state — illustration + CTA
3. Error state — retry button
4. Populated — happy path

## 11. Universal Rules
- Both light and dark themes for every page
- Mobile (375px) AND desktop (1280px) for every page
- All destructive actions require confirmation modal
- All mutations show button-level loading, never full-page spinners
- Toasts on success/error after every mutation

## 12. Tech Stack
- React, TypeScript, Tailwind CSS