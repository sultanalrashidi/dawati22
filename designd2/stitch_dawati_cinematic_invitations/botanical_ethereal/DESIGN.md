---
name: Botanical Ethereal
colors:
  surface: '#fff9f0'
  surface-dim: '#dfd9d1'
  surface-bright: '#fff9f0'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f9f3ea'
  surface-container: '#f3ede4'
  surface-container-high: '#ede7df'
  surface-container-highest: '#e7e2d9'
  on-surface: '#1d1b16'
  on-surface-variant: '#44483f'
  inverse-surface: '#32302a'
  inverse-on-surface: '#f6f0e7'
  outline: '#75786e'
  outline-variant: '#c5c8bc'
  surface-tint: '#526442'
  primary: '#526442'
  on-primary: '#ffffff'
  primary-container: '#9caf88'
  on-primary-container: '#324224'
  inverse-primary: '#b9cda4'
  secondary: '#54651e'
  on-secondary: '#ffffff'
  secondary-container: '#d7ec95'
  on-secondary-container: '#5a6b24'
  tertiary: '#705d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c6a700'
  on-tertiary-container: '#4a3d00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e9bf'
  primary-fixed-dim: '#b9cda4'
  on-primary-fixed: '#111f05'
  on-primary-fixed-variant: '#3b4c2c'
  secondary-fixed: '#d7ec95'
  secondary-fixed-dim: '#bbcf7c'
  on-secondary-fixed: '#161e00'
  on-secondary-fixed-variant: '#3d4c05'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#fff9f0'
  on-background: '#1d1b16'
  surface-variant: '#e7e2d9'
typography:
  display-lg:
    fontFamily: ebGaramond
    fontSize: 64px
    fontWeight: '400'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: ebGaramond
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.1'
  headline-md:
    fontFamily: ebGaramond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  body-lg:
    fontFamily: notoSerif
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: notoSerif
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  section-padding-desktop: 80px
  section-padding-mobile: 40px
---

## Brand & Style
The design system embodies a romantic, dreamlike, and natural aesthetic tailored for high-end horticultural experiences and editorial storytelling. It aims to evoke a sense of "expensive organicism"—where nature meets luxury. 

The visual style is a blend of **Editorial Minimalism** and **Tactile Organicism**. It prioritizes heavy whitespace (reminiscent of premium lifestyle magazines), high-quality floral photography, and soft, layered surfaces. The emotional response is one of tranquility, discovery, and curated beauty. UI elements should feel as though they are resting lightly on a bed of dappled sunlight, utilizing subtle textures like handmade paper or soft linen to reinforce the "natural but expensive" narrative.

## Colors
The palette is rooted in the natural world, moving away from digital vibrancy toward muted, sophisticated tones.

- **Rose Ivory (#FFF9F0):** This serves as the primary canvas color. It is warmer than pure white, providing a soft, paper-like background that feels historical yet fresh.
- **Soft Sage (#9CAF88):** Used for primary actions and decorative UI elements. It represents the lightness of new leaves.
- **Muted Olive (#708238):** Reserved for high-contrast elements, deep typography, and grounding borders.
- **Sunset Gold (#FFD700):** Applied sparingly as a "kiss of light"—used for small accents, active states, or premium membership badges to simulate sunlight filtering through trees.
- **Surface Accents:** Use light washes of Sage and Rose to create soft containment without the need for harsh lines.

## Typography
The typography is the cornerstone of the "Secret Garden" identity. It balances the romanticism of the West with the flowing heritage of the East.

- **English Script:** **EB Garamond** is used for all headlines. Its classical proportions and elegant serifs provide a timeless, literary feel. 
- **Arabic Script:** Use a Naskh-style modern serif (like **Amiri** or a refined **Noto Serif Arabic**) to match the weight and grace of EB Garamond. The script should feel fluid and ink-drawn, never mechanical.
- **Body & Utility:** **Noto Serif** provides exceptional readability for long-form editorial content. For small utility labels and metadata, **Manrope** is used in uppercase to provide a modern, organized counterpoint to the flowing serifs.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop to maintain an editorial "lookbook" feel, transitioning to a fluid model on mobile.

- **Rhythm:** Use a generous 8px base unit. Negative space is a functional element; do not crowd content.
- **Margins:** Desktop margins should be wide (minimum 80px) to allow the Rose Ivory background to frame the content like a mat around a painting.
- **Layering:** Implement "Editorial Offsets"—where images or text boxes slightly overlap or sit off-center from the grid to create a sense of organic growth rather than rigid structure.

## Elevation & Depth
Depth in this design system is achieved through **Tonal Layering** and **Atmospheric Blurs** rather than traditional drop shadows.

- **Tonal Tiers:** Use subtle shifts in background color (e.g., a card in a slightly darker cream or a very pale Sage wash) to indicate elevation.
- **Dappled Light:** Use SVG masks of leaf shadows or soft, organic "blobs" of light (low-opacity Sunset Gold) to create a sense of depth behind content containers.
- **Glassmorphism:** For overlays and navigation bars, use a high-intensity backdrop blur (30px+) with a 40% opaque Rose Ivory tint. This mimics the effect of frosted glass in a greenhouse.

## Shapes
Shapes are inspired by the curves of nature—stones, petals, and leaves. 

- **Corner Radii:** Use a "Rounded" (0.5rem) base for standard containers. However, use **Asymmetrical Radii** for large imagery (e.g., top-left and bottom-right corners rounded at 3rem, others at 0) to mimic organic leaf shapes.
- **Buttons:** Buttons should be fully pill-shaped to feel soft and inviting to the touch.
- **Icons:** Icons must use a light stroke weight (1px to 1.5px) with rounded terminals. Avoid sharp corners in any iconography.

## Components
- **Buttons:** Primary buttons use a Soft Sage background with Muted Olive text. The hover state should include a subtle "Sunset Gold" glow or border. Use a "ghost" style for secondary actions with a thin Olive border.
- **Cards:** Cards should have no visible borders. Use a soft background color shift or a very diffused, tinted shadow (`rgba(112, 130, 56, 0.05)`) to lift them from the Rose Ivory base.
- **Input Fields:** Bottom-border only or very soft-filled containers. Focus states should transition the border from Sage to Sunset Gold.
- **Chips/Tags:** Use organic, non-uniform shapes or high-roundedness pills in a light Rose or Sage wash.
- **Floral Overlays:** A unique component for this system is the "Vignette Element"—high-resolution, transparent PNGs of botanical illustrations that can be pinned to the corners of cards or sections to break the digital frame.