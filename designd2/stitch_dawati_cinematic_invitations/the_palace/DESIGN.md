---
name: The Palace
colors:
  surface: '#fef8f6'
  surface-dim: '#ded9d7'
  surface-bright: '#fef8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f2f0'
  surface-container: '#f2edeb'
  surface-container-high: '#ede7e5'
  surface-container-highest: '#e7e1df'
  on-surface: '#1d1b1a'
  on-surface-variant: '#4c4640'
  inverse-surface: '#32302f'
  inverse-on-surface: '#f5efed'
  outline: '#7e766f'
  outline-variant: '#cfc5bd'
  surface-tint: '#635d59'
  primary: '#635d59'
  on-primary: '#ffffff'
  primary-container: '#e0d7d1'
  on-primary-container: '#635d58'
  inverse-primary: '#cdc5bf'
  secondary: '#5e5f5d'
  on-secondary: '#ffffff'
  secondary-container: '#e0e0dd'
  on-secondary-container: '#626361'
  tertiary: '#675f32'
  on-tertiary: '#ffffff'
  tertiary-container: '#e5d9a1'
  on-tertiary-container: '#675e31'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#eae1db'
  primary-fixed-dim: '#cdc5bf'
  on-primary-fixed: '#1f1b17'
  on-primary-fixed-variant: '#4b4641'
  secondary-fixed: '#e3e2e0'
  secondary-fixed-dim: '#c7c6c4'
  on-secondary-fixed: '#1a1c1a'
  on-secondary-fixed-variant: '#464745'
  tertiary-fixed: '#efe3aa'
  tertiary-fixed-dim: '#d2c790'
  on-tertiary-fixed: '#201c00'
  on-tertiary-fixed-variant: '#4e471c'
  background: '#fef8f6'
  on-background: '#1d1b1a'
  surface-variant: '#e7e1df'
typography:
  display-lg:
    fontFamily: EB Garamond
    fontSize: 64px
    fontWeight: '400'
    lineHeight: 72px
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: EB Garamond
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0.01em
  headline-lg-mobile:
    fontFamily: EB Garamond
    fontSize: 32px
    fontWeight: '400'
    lineHeight: 38px
    letterSpacing: 0.01em
  headline-md:
    fontFamily: EB Garamond
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 34px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '300'
    lineHeight: 28px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
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
  gutter: 32px
  margin-mobile: 24px
  margin-desktop: 80px
  section-gap: 120px
---

## Brand & Style

The brand personality is architectural, grand, and profoundly serene. It evokes the feeling of walking through a contemporary sanctuary—one that blends historical gravity with modern minimalism. The target audience includes high-net-worth individuals, art patrons, and luxury travelers who seek silence and intentionality over noise and excess.

The design style is a hybrid of **Minimalism** and **Architectural Tactility**. It utilizes expansive white space to simulate the physical scale of a palace hall. Visual motifs are derived from contemporary Mediterranean and Middle Eastern architecture, specifically focusing on soft arches, stone textures, and the interplay of natural light and shadow. The interface should feel "built" rather than drawn, emphasizing structural permanence and quiet luxury.

## Colors

The palette is rooted in the natural materials of a sun-drenched estate. **Warm Stone (#E0D7D1)** serves as the primary structural color, used for secondary backgrounds and subtle borders to define space. **Soft Ivory (#FAF9F6)** is the canvas, providing a bright, airy base that mimics plaster and limestone.

**Champagne (#F1E5AC)** is reserved for moments of quiet celebration—active states, subtle highlights, or refined call-to-actions. The neutral color is a deep, warm charcoal rather than pure black, ensuring that typography maintains an organic relationship with the stone-colored backgrounds. Color application should be restrained; the "mood" is set by the vastness of the ivory and the warmth of the stone, not by vibrant accents.

## Typography

The typography strategy balances the classicism of the Serif with the technical precision of a Grotesque. **EB Garamond** is used for headlines to provide a literary, authoritative, and historical feel. High-level headers should utilize wide tracking (letter spacing) to enhance the "editorial" aesthetic.

**Hanken Grotesk** serves as the functional counterpart. It is used for body copy and UI labels to ensure absolute clarity and a contemporary edge. For Arabic content, use a high-contrast Naskh or a minimalist Kufic equivalent that matches the optical weight of EB Garamond, ensuring that both languages feel equally "architectural" and premium. All labels should be set in uppercase with generous letter spacing to evoke the feeling of engraved stone inscriptions.

## Layout & Spacing

This design system employs a **Fixed Grid** on desktop (12 columns) and a **Fluid Grid** on mobile (4 columns). The philosophy is "Maximum Breathing Room." Large-scale sections should be separated by significant vertical gaps to allow the eye to rest and to emphasize the "grandeur" of the content.

Horizontal margins are intentionally wide (80px on desktop) to center the focus and create a sense of exclusivity. Content should often be offset or asymmetrical to mimic the varied perspectives found in palace architecture. Spacing units are strictly based on an 8px scale, but preference should always be given to the larger increments (32px, 64px, 120px) to maintain the sense of scale.

## Elevation & Depth

Depth is communicated through **Ambient Shadows** and **Tonal Layering**, rather than traditional drop shadows. Shadows should be extremely diffused, using a hint of the Stone (#E0D7D1) color in the shadow's tint to simulate warm ambient lighting hitting a surface.

Key techniques:
- **Soft Insets:** Use very subtle inner shadows on containers to create a "carved from stone" effect.
- **Architectural Arches:** High-level containers and image frames should utilize a large top-radius (arched) to provide verticality.
- **Tonal Tiers:** Surfaces placed "closer" to the user should transition from Warm Stone to Soft Ivory, creating a natural progression of light.
- **Backdrop Blurs:** When overlays are necessary, use a high-saturation, low-opacity blur to maintain the warmth of the background elements while focusing the user.

## Shapes

The shape language is defined by the **Arch**. While standard UI elements like buttons use a refined 0.5rem (Rounded) corner, primary containers, featured images, and structural modules should utilize a specialized `rounded-arch` class. 

The `rounded-arch` is defined by a top-only border-radius that is significantly higher (e.g., 200px or 50% of width) to create a contemporary archway silhouette. Small interactive elements should remain subtly rounded to feel soft to the touch, avoiding the harshness of sharp corners while maintaining the discipline of a structured architectural plan.

## Components

### Buttons
Primary buttons are solid **Warm Stone** with **Neutral** text. They feature a generous internal padding (16px 32px) and no border. The "Champagne" color is used exclusively for a 2px bottom underline or a subtle glow on hover.

### Input Fields
Fields are styled as "Underlined" rather than boxed, mimicking the simplicity of a gallery label. The baseline is a 1px Stone stroke that thickens slightly on focus. Labels sit high above the line in the `label-md` typographic style.

### Cards & Arches
Featured content should be housed in **Arched Cards**. The top of the card is a perfect semi-circle, while the bottom remains square or subtly rounded. This creates a rhythmic "colonnade" effect when cards are placed side-by-side in a grid.

### Lists
Lists are separated by thin, low-opacity Stone dividers. Each item should have significant vertical padding (24px) to ensure the layout never feels cramped.

### Navigation
The navigation should be minimal and fixed. Use a "Glassmorphic" Soft Ivory background with high blur to ensure the architectural background remains visible as the user scrolls, creating a sense of layered depth.