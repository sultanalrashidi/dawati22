---
name: Dawati Core
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#4c463d'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#7d766c'
  outline-variant: '#cec5b9'
  surface-tint: '#6a5d43'
  primary: '#6a5d43'
  on-primary: '#ffffff'
  primary-container: '#e5d3b3'
  on-primary-container: '#675a41'
  inverse-primary: '#d6c4a5'
  secondary: '#7b5455'
  on-secondary: '#ffffff'
  secondary-container: '#fdcbcb'
  on-secondary-container: '#795354'
  tertiary: '#5b5d6e'
  on-tertiary: '#ffffff'
  tertiary-container: '#d3d4e8'
  on-tertiary-container: '#595b6c'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f3e0c0'
  primary-fixed-dim: '#d6c4a5'
  on-primary-fixed: '#231a06'
  on-primary-fixed-variant: '#51452d'
  secondary-fixed: '#ffdad9'
  secondary-fixed-dim: '#ecbbba'
  on-secondary-fixed: '#2f1314'
  on-secondary-fixed-variant: '#603d3e'
  tertiary-fixed: '#e0e1f5'
  tertiary-fixed-dim: '#c4c5d9'
  on-tertiary-fixed: '#181b29'
  on-tertiary-fixed-variant: '#434656'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 8px
  sm: 16px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 20px
  margin-mobile: 20px
  margin-desktop: 120px
---

## Brand & Style

The design system is anchored in **Modern Luxury** and **Premium Editorial** aesthetics. It evokes an emotional response of serenity, sophistication, and timelessness. Borrowing from Apple-like simplicity, the UI prioritizes negative space and high-quality typography over decorative clutter. 

The visual language is characterized by:
- **Quiet Luxury:** Using subtle tonal shifts rather than heavy borders or shadows.
- **Editorial Pace:** Layouts that feel like a high-end wedding magazine, with generous leading and purposeful alignment.
- **Bilingual Harmony:** A seamless transition between Arabic (RTL) and English (LTR) that maintains a consistent typographic weight and "color" on the page.

## Colors

The palette is inspired by natural parchment, fine linen, and precious metals.

- **Warm Ivory:** Used as the primary canvas to provide a softer, more premium feel than pure white.
- **Champagne & Dusty Rose:** These accents are used for primary actions and soft highlights. They should never overwhelm the layout; use them as delicate "threads" throughout the UI.
- **Charcoal:** Provides high-legibility grounding for text and deep contrast in dark mode.

In Dark Mode, the ivory transitions to the primary text color, maintaining the "warmth" of the brand even in a low-light environment.

## Typography

This design system utilizes a high-contrast serif for headlines to establish an editorial feel, paired with a clean, geometric sans-serif for functional text.

**Arabic Implementation:**
Use **IBM Plex Sans Arabic** for all weights. Ensure the line-height for Arabic text is increased by 15-20% compared to English to accommodate the script's ascenders and descenders without crowding.

**Hierarchical Rules:**
- Use `display-lg` for invitation names and major section headers.
- `label-sm` should be used for metadata and small captions, always with increased letter spacing for a "gallery" look.

## Layout & Spacing

The layout philosophy is a **Fixed-Fluid Hybrid**. Content is contained within a max-width of 1280px on desktop to maintain readability, while mobile layouts use generous 20px side margins to feel airy.

**RTL Logic:**
The entire layout must mirror perfectly for Arabic users. All icons with directional meaning (arrows, chevrons) must be flipped. Use logical properties (`margin-inline-start` instead of `margin-left`) in development.

**Rhythm:**
Use the `lg` (48px) spacing unit between major sections to prevent the UI from feeling cramped. White space is considered a design element in itself.

## Elevation & Depth

To maintain "Apple-like" simplicity, this design system avoids heavy shadows. 

- **Tonal Elevation:** Surfaces are differentiated primarily by color (e.g., a white card on an ivory background).
- **The "Glow" Shadow:** For floating elements like Primary Buttons or Modals, use a very large blur (30px-40px) with very low opacity (5-8%) using the Primary Champagne color as the shadow tint. This creates a soft halo rather than a muddy drop shadow.
- **Glassmorphism:** Use `backdrop-filter: blur(20px)` on top navigation bars and mobile bottom bars to allow the background content to bleed through subtly, maintaining a sense of depth and place.

## Shapes

The shape language is **Soft & Sophisticated**. 
- **Cards & Containers:** Use a consistent 16px radius (`rounded-xl` equivalent in this system).
- **Interactive Elements:** Buttons and Input fields use a 12px radius to feel modern but structured.
- **Avatars:** Always circular.
- **Borders:** Use 1px width for all borders. Colors should be only 10% darker/lighter than the surface color they sit upon.

## Components

### Buttons
- **Primary:** Background in Champagne (#E5D3B3), Text in Charcoal. High-gloss finish is avoided; use a flat matte fill.
- **Ghost:** No background, 1px border in Champagne. Used for secondary actions like "View Details".
- **Interaction:** On hover/active, the button should scale down slightly (98%) rather than changing color drastically.

### Input Fields
- **Minimalist Style:** Only a bottom border (1px) in light mode, or a very light tonal fill. No heavy boxes. Labels should be small and positioned above the line.
- **Focus State:** The bottom border thickens to 2px and transitions to Champagne.

### Cards
- Surfaces should have a subtle inner-glow or a very thin 1px border in a "Champagne-white" tint. 
- Padding inside cards should be at least `md` (24px) to ensure content doesn't touch the edges.

### Bottom Navigation (Mobile)
- A floating "pill" or a docked bar with a heavy backdrop blur.
- Icons should be ultra-thin line style (1px stroke). 
- Active state is indicated by a small dot below the icon in Dusty Rose (#D4A5A5).

### Lists & Dividers
- Dividers should never be solid black or grey. Use a 5% opacity version of the text color.
- List items should have generous vertical padding (16px+) to ensure a premium, unhurried feel.