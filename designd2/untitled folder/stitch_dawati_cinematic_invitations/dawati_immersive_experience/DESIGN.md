---
name: Dawati Immersive Experience
colors:
  surface: '#19120e'
  surface-dim: '#19120e'
  surface-bright: '#413733'
  surface-container-lowest: '#140d09'
  surface-container-low: '#221a16'
  surface-container: '#261e1a'
  surface-container-high: '#312824'
  surface-container-highest: '#3c332f'
  on-surface: '#efdfd9'
  on-surface-variant: '#d3c3bd'
  inverse-surface: '#efdfd9'
  inverse-on-surface: '#382e2b'
  outline: '#9c8e88'
  outline-variant: '#4f4440'
  surface-tint: '#e3bfb0'
  primary: '#e3bfb0'
  on-primary: '#422b21'
  primary-container: '#2e1a11'
  on-primary-container: '#9f8073'
  inverse-primary: '#74584d'
  secondary: '#d3c5ad'
  on-secondary: '#382f1e'
  secondary-container: '#524835'
  on-secondary-container: '#c5b79f'
  tertiary: '#c7c7ba'
  on-tertiary: '#2f3128'
  tertiary-container: '#1e2017'
  on-tertiary-container: '#86887b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdbcd'
  primary-fixed-dim: '#e3bfb0'
  on-primary-fixed: '#2a170e'
  on-primary-fixed-variant: '#5a4136'
  secondary-fixed: '#f0e0c8'
  secondary-fixed-dim: '#d3c5ad'
  on-secondary-fixed: '#221b0b'
  on-secondary-fixed-variant: '#4f4533'
  tertiary-fixed: '#e3e3d5'
  tertiary-fixed-dim: '#c7c7ba'
  on-tertiary-fixed: '#1b1c14'
  on-tertiary-fixed-variant: '#46483d'
  background: '#19120e'
  on-background: '#efdfd9'
  surface-variant: '#3c332f'
typography:
  display-hero:
    fontFamily: Playfair Display
    fontSize: 80px
    fontWeight: '400'
    lineHeight: 90px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '400'
    lineHeight: 56px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 40px
  body-xl:
    fontFamily: Be Vietnam Pro
    fontSize: 20px
    fontWeight: '300'
    lineHeight: 32px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.15em
spacing:
  safe-margin: 4rem
  safe-margin-mobile: 1.5rem
  section-gap: 10rem
  element-gap: 2rem
  gutter: 24px
---

## Brand & Style
The design system is centered on a cinematic, high-luxury wedding narrative. It moves away from traditional paper-based digital invitations, instead opting for a filmic, immersive digital environment. The target audience is high-net-worth guests who value discretion, elegance, and exclusivity.

The aesthetic blends **Minimalism** with **Glassmorphism**, emphasizing depth through light and texture rather than physical borders or containers. The emotional response is one of reverence and anticipation—a quiet, powerful luxury that feels curated rather than crowded.

## Colors
The palette is rooted in deep earth and metallic light. **Deep Espresso** (#2E1A11) acts as the foundation, providing a rich, velvet-like background that allows light to pop. **Warm Champagne** (#F7E7CE) is used exclusively for primary highlights, interactive elements, and key monograms. **Ivory** (#FFFFF0) provides a soft, readable contrast for body text and descriptive information. 

The color mode is strictly **Dark**, ensuring that the "cinematic" feel is maintained and that the Champagne highlights feel glowing and luminous.

## Typography
The typography uses a high-contrast serif for English names and focal points to evoke an editorial fashion quality. For Arabic text, the system defaults to a sophisticated, clean sans-serif that mirrors the modern, refined tone of the identity.

- **English Names (SARA & MOHAMMED):** Always set in `display-hero` using Playfair Display. This is the centerpiece of the layout.
- **Arabic Text:** Use a high-quality modern Arabic sans (rendered via Be Vietnam Pro parameters for layout consistency) with generous line-height to ensure readability.
- **Hierarchy:** Use wide tracking on `label-caps` for metadata (dates, locations) to create a premium, rhythmic feel.

## Layout & Spacing
The layout follows a **Fluid Grid** with extremely generous negative space to emphasize the "minimal but premium" style. There are no visible containers; elements float on the Espresso background, anchored by strong alignment.

- **Desktop:** A 12-column grid with wide safe margins (4rem). Elements should rarely span the full width, favoring asymmetric placements that feel like an art gallery layout.
- **Mobile:** A 4-column grid with 1.5rem margins. Verticality is key—utilize full-height (100vh) sections to maintain the cinematic "scroll as a scene" experience.
- **Transitions:** Spacing between major content blocks (e.g., Invitation Text to Venue Details) should be massive (10rem) to allow the eye to rest and the background textures to take center stage.

## Elevation & Depth
This design system rejects traditional shadows and borders. Depth is created through **Tonal Layers** and **Lighting Effects**:

- **Backdrop Blurs:** Instead of cards, use 40px background blurs to separate overlapping text from photography.
- **Radial Glows:** Subtle, low-opacity Warm Champagne radial gradients behind key text to simulate a spotlight on a stage.
- **Texture Overlays:** A fine, high-frequency grain overlay (2% opacity) is applied to the entire UI to give it a cinematic film feel.
- **Z-Index Parallax:** Elements should move at slightly different speeds during scroll to create a sense of physical space and depth without needing lines or boxes.

## Shapes
The shape language is **Sharp (0)**. The absence of rounded corners communicates a sophisticated, architectural precision. Interactive elements like "RSVP" buttons or "View Map" links should be defined by their typography and thin, precise underlines or full-width backgrounds, never rounded buttons. This maintains the high-fashion editorial look.

## Components
- **Primary Action (RSVP):** A text-based button using `label-caps`. Interaction is shown through a 1px Champagne underline that expands from the center on hover. No box, no shadow.
- **Input Fields:** A single 1px Ivory line at the bottom of the field. The label floats above in small-caps Champagne when active.
- **Lists (Timeline):** Vertically aligned text with no bullet points. Use a simple vertical line (0.5pt Ivory) to connect times/events, creating a refined "string of pearls" effect.
- **Interactive Map:** Housed in a full-screen modal with a heavy backdrop blur. No border on the map container.
- **Imagery:** Photography should use a "fade to black" gradient at the edges to blend seamlessly into the Deep Espresso background, avoiding hard rectangular edges where possible.
- **Monogram:** A secondary brand element in Champagne gold, appearing as a subtle watermark or transition element between sections.