---
name: HANDSHAKE
description: Gesture-controlled live music mangler — a dark stage instrument panel, not a SaaS dashboard
colors:
  bg-void: "oklch(0.14 0.01 260)"
  bg-surface: "oklch(0.20 0.012 260)"
  bg-surface-raised: "oklch(0.25 0.014 260)"
  fg-primary: "oklch(0.95 0.015 80)"
  fg-secondary: "oklch(0.68 0.02 80)"
  fg-tertiary: "oklch(0.45 0.015 260)"
  accent-left: "oklch(0.74 0.15 205)"
  accent-left-dim: "oklch(0.42 0.09 205)"
  accent-right: "oklch(0.78 0.16 55)"
  accent-right-dim: "oklch(0.45 0.10 55)"
  accent-danger: "oklch(0.62 0.19 25)"
  hairline: "oklch(0.95 0.015 80 / 0.09)"
typography:
  display:
    fontFamily: "-apple-system, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 5vw, 3.5rem)"
    fontWeight: 650
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "-apple-system, 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.06em"
  numeric:
    fontFamily: "ui-monospace, 'Cascadia Code', 'Cascadia Mono', Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0"
rounded:
  none: "0px"
  sm: "6px"
  md: "10px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.fg-primary}"
    textColor: "{colors.bg-void}"
    typography: "{typography.title}"
    rounded: "{rounded.pill}"
    padding: "16px 36px"
  button-secondary:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.fg-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  hud-panel-left:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.fg-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "14px 18px"
  hud-panel-right:
    backgroundColor: "{colors.bg-surface}"
    textColor: "{colors.fg-primary}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "14px 18px"
---

# Design System: HANDSHAKE

## 1. Overview

**Creative North Star: "The Stage Console"**

HANDSHAKE is read at arm's length, in a dim room, in under a second, while
the performer's actual attention is on their own hands. That constraint
rules out almost every conventional app-UI move: no card grids to scan, no
sidebar to navigate, no hover states to discover. What's left is an
instrument panel — the visual language of a hardware DJ mixer or a
synthesizer's front panel translated to screen. Flat surfaces, hairline
dividers, tabular numeric readouts, and exactly two identity colors that
never change meaning.

This system explicitly rejects the corporate dashboard (card grids, metric
tiles, sidebar nav), the marketing landing page (hero sections, scroll
storytelling), club-flyer maximalism (neon glow, gradient text, saturated
backgrounds), and skeuomorphic fake hardware (fake brushed metal, fake LED
glyphs). It is not decorated. Every color on screen encodes something —
which hand, what state, where in the bar — or it isn't there.

**Key Characteristics:**
- Flat, tonally-layered surfaces — no drop shadows, no glass blur
- Two hand-identity colors (cyan-left, amber-right), used with total
  consistency across skeleton, HUD, and effect state — never reused for
  anything else
- Tabular monospace for every number (BPM, percentages, Hz) so readouts
  feel measured, not decorative
- Motion exists only to narrate a state change (armed → engaged), never as
  ambient decoration

## 2. Colors

The palette is built from a single near-black hue family for structure,
plus two saturated identity colors that are load-bearing information, not
decoration — this is a deliberate exception to the "one accent" product
default, justified by the product's core two-hand mechanic.

### Primary
- **Cyan Signal** (`oklch(0.74 0.15 205)`, key `accent-left`): left hand's
  identity color. Used on the left HUD panel, the left skeleton overlay,
  left-hand parameter arcs, and nowhere else in the interface.
- **Amber Signal** (`oklch(0.78 0.16 55)`, key `accent-right`): right
  hand's identity color, with the identical scope of use as Cyan Signal
  but mirrored.

### Secondary
- **Cyan Signal, Dim** (`oklch(0.42 0.09 205)`, key `accent-left-dim`) /
  **Amber Signal, Dim** (`oklch(0.45 0.10 55)`, key `accent-right-dim`):
  the same identity colors at rest — armed-but-not-engaged, or historical
  markers (e.g. a played-out waveform region). Never used for a hand that
  is actively engaged; that state always gets full saturation.

### Neutral
- **Void** (`oklch(0.14 0.01 260)`, key `bg-void`): base background. Not
  pure black — carries a whisper of the cyan/amber hue family so it never
  reads as a default dark-mode gray.
- **Console Surface** (`oklch(0.20 0.012 260)`, key `bg-surface`): resting
  surface for HUD panels, buttons, and the controls bar. One tonal step up
  from Void — the layering mechanism, not a shadow.
- **Console Surface, Raised** (`oklch(0.25 0.014 260)`, key
  `bg-surface-raised`): hover/pressed state for interactive elements.
- **Primary Ink** (`oklch(0.95 0.015 80)`, key `fg-primary`): primary text,
  warm-tinted off-white, never pure `#fff`.
- **Secondary Ink** (`oklch(0.68 0.02 80)`, key `fg-secondary`): supporting
  text — track metadata, helper copy.
- **Tertiary Ink** (`oklch(0.45 0.015 260)`, key `fg-tertiary`): disabled
  states, inactive skeleton points.
- **Hairline** (`oklch(0.95 0.015 80 / 0.09)`, key `hairline`): the only
  border weight in the system.

### Named Rules
**The Two-Signal Rule.** Cyan and amber mean left hand and right hand and
nothing else, ever. If a new element needs a color and isn't tied to a
specific hand, it uses a neutral, not a signal color.

**The No-Glow Rule.** No `box-shadow` blur, no `backdrop-filter` blur, no
glass panels. Depth comes from the three-step neutral ramp
(Void → Surface → Surface Raised) alone.

## 3. Typography

**Display Font:** System UI stack — `-apple-system, "Segoe UI Variable
Display", "Segoe UI", system-ui, sans-serif`
**Body Font:** Same family, text optical size — `"Segoe UI Variable Text"`
falls back to `"Segoe UI"`
**Numeric/Label Font:** `ui-monospace, "Cascadia Code", "Cascadia Mono",
Consolas, monospace`

**Character:** Confident and native, not typographically showy. This is an
instrument panel a performer glances at, not an editorial page they read —
a system font stack renders instantly, needs no network fetch (the app
must stay usable offline, per the product's camera-data-never-leaves-the-
machine posture), and looks correct on the Windows machines this ships to
first.

### Hierarchy
- **Display** (650, `clamp(2.5rem, 5vw, 3.5rem)`, 1.05): the current
  track title in the transport bar. The single largest thing on screen.
- **Title** (600, 1.375rem, 1.2): HUD panel headers (active effect name),
  section headers, primary button labels.
- **Body** (400, 1.125rem, 1.5): status copy, onboarding text, secondary
  labels. Nothing performance-critical is ever smaller than this.
- **Label** (600, 0.8125rem, 1.3, +0.06em tracking, uppercase): field
  labels, badges ("PINCH", "ENGAGED"), button microcopy.
- **Numeric** (500, 1rem, 1.2, monospace, tabular): every measured value —
  BPM, percentages, Hz, dB. Always monospace so digits don't reflow the
  layout as they change.

### Named Rules
**The Measured-Number Rule.** Any value that updates in real time (pinch
%, cutoff Hz, BPM) is set in the Numeric role. Static labels never are.

## 4. Elevation

Flat by default. There are no drop shadows anywhere in this system — depth
is conveyed entirely through the three-step neutral background ramp (Void
→ Console Surface → Console Surface, Raised) and through the hairline
border. A panel that is "closer" to the performer is one step lighter, not
one shadow deeper.

### Named Rules
**The Flat-By-Default Rule.** No `box-shadow`, no blur, anywhere in the
static UI. The one narrow exception is a state-change pulse (§6,
Components) — a brief, fully-opaque ring, not a blurred glow — marking the
exact instant a hand goes from armed to engaged.

## 5. Components

### Buttons
- **Shape:** Fully rounded (`rounded.pill`, 999px) for the single primary
  action (Start); small-radius rectangle (`rounded.sm`, 6px) for secondary
  controls (Load Track, Play). The pill is reserved for the one
  highest-stakes action per screen.
- **Primary:** Primary Ink background, Void text, Title typography, 16px
  36px padding. No gradient. Pressed state drops to 96% scale, no color
  change — this is a physical button being pressed, not a link being
  hovered.
- **Secondary:** Console Surface background, Primary Ink text, Label
  typography, hairline border, 10px 18px padding. Hover moves to Console
  Surface Raised.
- **Disabled:** Console Surface background at reduced opacity (0.4), no
  border, no pointer cursor.

### HUD Panels (signature component)
The wrist-anchored readout is the product's signature element — not a
card, an instrument readout. Console Surface background, hairline border
in that hand's dim signal color, Title typography for the effect name and
Numeric typography for its live values. No blur, no shadow. A panel at
rest (armed) sits at 55% opacity with the dim signal border; the instant
the hand engages, it snaps to 100% opacity and the border switches to the
full-saturation signal color — this transition is the single most
important motion event in the app (§6 rule below) and must be visually
unmistakable.

### Confidence Meter
Not a gradient progress bar. A row of discrete tick segments (like a VU
meter), lit in signal-neutral Primary Ink, dimming and desaturating toward
Tertiary Ink as tracking confidence drops. Segments, not a continuous fill
— it reads as a measurement, not decoration.

### Transport Bar
Track title in Display type, centered. Waveform strip below it: flat fill
in Secondary Ink, beat ticks in hairline opacity, phrase ticks (every 8
bars) in full Primary Ink, playhead as a solid 2px Primary Ink line. No
container, no card — it sits directly on the Void background.

### Start Screen
Full-bleed Void background, no card, no glass panel. Display-weight
wordmark, one line of Body-weight subhead, one primary pill button, one
line of Numeric-weight status text below it that updates step-by-step
("Requesting camera…", "Loading hand tracking model…") so the wait never
reads as a frozen app.

## 6. Do's and Don'ts

### Do:
- **Do** use flat Console Surface panels with a single hairline border for
  every grouped element — the HUD, the controls bar, the start screen's
  status line.
- **Do** keep Cyan Signal and Amber Signal scoped exclusively to their
  hand's skeleton, HUD, and parameter arcs.
- **Do** set every live-updating number in the monospace Numeric role.
- **Do** make the armed → engaged transition an unmistakable, instant
  visual event (opacity snap + border color snap), never a slow fade.
- **Do** use ease-out-quart/expo curves for all transitions; never bounce
  or overshoot.

### Don't:
- **Don't** use card grids, metric tiles, or sidebar navigation — this is
  a corporate-dashboard pattern this product explicitly rejects.
- **Don't** use `backdrop-filter` blur or glass panels anywhere — the
  No-Glow Rule is absolute.
- **Don't** use gradient fills on buttons or gradient text — flat, single
  solid colors only, per the shared design laws' absolute ban.
- **Don't** use `border-left`/`border-right` colored stripes as accents on
  any element — use a full hairline border or a background tint instead.
- **Don't** introduce a third signal color. If something new needs
  color-coding and isn't tied to a hand, it gets a neutral, not a hue.
- **Don't** animate layout properties (width, height, top/left) for
  anything performance-critical — use transform/opacity so the compositor
  keeps the vision loop's frame budget, per the product's latency
  constraints.
