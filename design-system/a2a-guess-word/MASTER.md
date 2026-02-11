# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** A2A Guess Word
**Updated:** 2026-02-11
**Category:** AI Agent Gaming / Social Platform
**Design Concept:** AI 时代 Agent 与人类社交的新形式

---

## Global Rules

### Color Palette (Second.me Inspired Purple)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#7C3AED` | `--color-primary` |
| Primary Hover | `#6D28D9` | `--color-primary-hover` |
| Secondary | `#A78BFA` | `--color-secondary` |
| Accent/CTA | `#F59E0B` | `--color-accent` |
| Background | `#FAFAFF` | `--color-background` |
| Surface | `#FFFFFF` | `--color-surface` |
| Text | `#1E1B4B` | `--color-text` |
| Text Secondary | `#6B7280` | `--color-text-secondary` |
| Text Muted | `#9CA3AF` | `--color-text-muted` |
| Border | `#E5E7EB` | `--color-border` |
| Success | `#10B981` | `--color-success` |
| Error | `#EF4444` | `--color-error` |

**Gradients:**
- Hero: `linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)`
- Purple: `linear-gradient(135deg, #7C3AED, #A855F7)`

### Typography

- **Heading Font:** Space Grotesk
- **Body Font:** Inter
- **Monospace Font:** JetBrains Mono (for game words, IDs, code)
- **Mood:** Modern, competitive, gaming, clean, technical
- **Google Fonts:** [Space Grotesk + Inter + JetBrains Mono](https://fonts.google.com/share?selection.family=Space+Grotesk:wght@400;500;600;700|Inter:wght@300;400;500;600;700|JetBrains+Mono:wght@400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `0.25rem` | Tight gaps |
| `--space-sm` | `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `1rem` | Standard padding |
| `--space-lg` | `1.5rem` | Section padding |
| `--space-xl` | `2rem` | Large gaps |
| `--space-2xl` | `3rem` | Section margins |
| `--space-3xl` | `4rem` | Hero padding |
| `--space-4xl` | `6rem` | Major sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | Buttons, inputs |
| `--radius-md` | `12px` | Cards, small panels |
| `--radius-lg` | `16px` | Panels, modals |
| `--radius-xl` | `24px` | Hero cards, featured |
| `--radius-full` | `9999px` | Pills, badges, avatars |

### Shadow Depths (Purple-tinted)

| Level | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation |
| `--shadow-md` | Cards, buttons |
| `--shadow-lg` | Modals, dropdowns |
| `--shadow-xl` | Hero, featured |
| `--shadow-glow` | Active/focus states |

---

## Page Structure

| Page | Route | Type |
|------|-------|------|
| Landing | `/` | Static |
| Game Lobby | `/play` | Client |
| Game Room | `/room/[roomId]` | Client |
| Results | `/results/[matchId]` | Server |
| Leaderboard | `/leaderboard` | Client |

---

## Component Specs

### Buttons

```css
.btn--primary { background: #7C3AED; color: white; border-radius: 8px; }
.btn--secondary { background: white; color: #7C3AED; border: 2px solid #E5E7EB; }
.btn--accent { background: #F59E0B; color: white; }
.btn--gradient { background: linear-gradient(135deg, #7C3AED, #EC4899, #F59E0B); }
.btn--ghost { background: transparent; color: #6B7280; }
```

### Cards

```css
.card { background: white; border: 1px solid #E5E7EB; border-radius: 16px; }
.card--dark { background: #3B0764; color: white; }
.card--glass { background: rgba(255,255,255,0.8); backdrop-filter: blur(8px); }
```

### Inputs

```css
.input { border: 1.5px solid #E5E7EB; border-radius: 8px; }
.input:focus { border-color: #7C3AED; box-shadow: 0 0 0 3px rgba(124,58,237,0.1); }
```

---

## Style Guidelines

**Style:** Vibrant Modern Gaming

**Keywords:** Purple gradients, competitive, energetic, clean, modern, bold headers, gaming feel

**Best For:** AI gaming, social platforms, competitive experiences, hackathon demos

**Key Effects:** Purple dark hero sections, gradient accents, frosted glass navbar, smooth 200ms transitions, slide-up animations, pulse animations for live status

### Design Patterns
- **Navbar:** Sticky, frosted glass (backdrop-blur), with gradient brand icon
- **Hero:** Dark purple background with gradient overlay and radial glows
- **Cards:** White surface, subtle borders, purple-tinted shadows
- **Buttons:** Primary (purple), Secondary (outlined), Accent (amber), Gradient (hero CTA)
- **Status Badges:** Rounded pills with pulsing dots
- **Word Display:** Dark purple container with letter slots
- **Player Cards:** Avatar initial + info + score layout

---

## Anti-Patterns (Do NOT Use)

- No emojis as icons — Use SVG icons (inline SVGs)
- No missing cursor:pointer — All clickable elements must have cursor:pointer
- No layout-shifting hovers — Avoid scale transforms that shift layout
- No low contrast text — Maintain 4.5:1 minimum contrast ratio
- No instant state changes — Always use transitions (150-300ms)
- No invisible focus states — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

- [x] No emojis used as icons (use SVG instead)
- [x] All icons are inline SVGs (consistent style)
- [x] `cursor-pointer` on all clickable elements
- [x] Hover states with smooth transitions (150-300ms)
- [x] Light mode: text contrast 4.5:1 minimum
- [x] Focus states visible for keyboard navigation
- [x] `prefers-reduced-motion` respected
- [x] Responsive: 375px, 768px, 1024px, 1440px
- [x] No content hidden behind fixed navbars
- [x] No horizontal scroll on mobile
