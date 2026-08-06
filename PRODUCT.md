# Product

## Register

product

## Users

One performer, alone, at home or at a small party, standing about 1.2 metres
from a laptop with a webcam. Ambient light is party-dim, not office-bright.
They glance at the screen for under a second at a time — their attention is
on their own hands, not the UI. Arms are frequently raised. This is not a
professional club DJ and not a mobile user; it's someone using their own
laptop as a hands-free effects instrument.

## Product Purpose

HANDSHAKE turns hand gestures (tracked via webcam) into live audio effects
and DJ-style track transitions. The product IS the performance instrument —
every screen exists to be read in a fraction of a second, mid-gesture,
without breaking the performer's flow. Success: a first-time user can
deliberately sweep a filter and understand which hand did it within 90
seconds of launch.

## Brand Personality

Dark stage instrument. Confident, minimal, high-contrast — closer to a
hardware DJ mixer or Ableton Live's performance view than a SaaS dashboard.
Precise, not playful; an instrument panel, not a toy.

## Anti-references

Not a corporate/SaaS dashboard (no card grids, no metric tiles, no sidebar
nav). Not a marketing landing page. Not a mobile app. Not club-flyer
maximalism (no neon gradients, no glow-everything). Not skeuomorphic fake
hardware (no fake brushed metal, no fake LEDs-as-images).

## Design Principles

- **Legible at arm's length, in a dark room, in under a second.** Every
  performance-critical element (current effect, engagement state, tracking
  confidence) must read correctly from 1.5m with a glance, not a study.
- **The UI is a byproduct of the hands, not the other way around.** Screen
  elements orient around wrist position and gesture state; nothing demands
  the performer look away from their hands to operate it.
- **State changes must be visually unmistakable, motion must never lie.**
  The instant a hand goes from armed to engaged is the instant sound
  changes — the UI has to make that transition impossible to miss, with
  motion that never overshoots (overshoot in the UI would imply overshoot
  in the audio, which would be false).
- **No decoration that isn't information.** Every color, glow, or line
  either encodes hand identity, engagement state, or musical structure
  (beat/phrase). Nothing is there just to look impressive.
- **Two hands, two identities, always distinguishable.** Left/right hand
  accents must be readable even in peripheral vision — no relying on a
  single visual channel.

## Accessibility & Inclusion

Standard WCAG AA contrast targets. Minimum type size 18px per the existing
spec requirement (readable at 1.5m in a dim room). Motion is meaningful
(state-change signaling) so respect `prefers-reduced-motion` by shortening
transition durations rather than removing state-change feedback entirely
(the state change itself is safety-critical information, not decoration).
