---
name: Couture Editorial
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#ccc6b7'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#959083'
  outline-variant: '#4a473b'
  surface-tint: '#d4c78f'
  primary: '#ffffff'
  on-primary: '#383006'
  primary-container: '#f1e3a9'
  on-primary-container: '#6e6436'
  inverse-primary: '#685e31'
  secondary: '#c9c6c5'
  on-secondary: '#313030'
  secondary-container: '#474646'
  on-secondary-container: '#b7b4b4'
  tertiary: '#ffffff'
  on-tertiary: '#2e312f'
  tertiary-container: '#e2e3df'
  on-tertiary-container: '#636562'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f1e3a9'
  primary-fixed-dim: '#d4c78f'
  on-primary-fixed: '#211b00'
  on-primary-fixed-variant: '#4f471b'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c9c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e2e3df'
  tertiary-fixed-dim: '#c5c7c3'
  on-tertiary-fixed: '#191c1a'
  on-tertiary-fixed-variant: '#454745'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display-lg:
    fontFamily: Bodoni Moda
    fontSize: 84px
    fontWeight: '700'
    lineHeight: 92px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Bodoni Moda
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Bodoni Moda
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 56px
  headline-md:
    fontFamily: Bodoni Moda
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.15em
  arabic-display:
    fontFamily: Hanken Grotesk
    fontSize: 42px
    fontWeight: '600'
    lineHeight: '1.4'
spacing:
  container-max: 1440px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-xl: 120px
  stack-md: 48px
---

## Brand & Style
The design system embodies the high-stakes world of haute couture, blending the tactile elegance of flowing silk with the rigid structure of a fashion editorial. It targets a discerning audience that values exclusivity, craftsmanship, and avant-garde aesthetics.

The visual direction is **Minimalist-Editorial**. It utilizes expansive white space (Pearl White), sharp high-contrast transitions to Midnight Black, and luxurious Champagne Silk accents to simulate the sheen of high-end textiles. The emotional response should be one of "intimidating beauty"—sophisticated, authoritative, and unapologetically premium. 

Compositional elements include over-sized typography, intentional "ink-trap" aesthetics, and a rhythmic use of scale that mirrors a printed fashion magazine.

## Colors
This design system operates primarily in a high-contrast dark mode to emphasize the "Midnight" and "Charcoal" tones, allowing the "Champagne Silk" to serve as a luminous call-to-action.

- **Midnight Black (#050505):** The foundation. Used for deep backgrounds and primary structural containers.
- **Charcoal Silk (#1C1C1C):** Used for elevated surfaces, secondary sections, and subtle UI depth.
- **Pearl White (#FBFCF8):** Primary text color and high-impact graphic dividers. It should feel like high-grade uncoated paper.
- **Champagne Silk (#F3E5AB):** The accent color. Reserved for interactive states, luxury markers, and premium highlights. It represents the "glow" of the fabric.

## Typography
The typography is the core of this design system's editorial identity. 

**Bodoni Moda** is used for all headlines and display elements. Its high-contrast strokes and sharp serifs evoke the heritage of *Vogue* and *Harper’s Bazaar*. For the English names, use tight tracking in display sizes to create a "locked-in" editorial look.

**Hanken Grotesk** provides a sharp, minimalist counterpoint. It is used for all body copy and UI labels to ensure modern legibility. 

For **Arabic Typography**, maintain a minimalist and sharp aesthetic. Use thin weights for body text and bold, architectural weights for headlines, ensuring the baseline alignment respects the vertical rhythm of the Bodoni counterparts. All UI labels should use the `label-caps` style to maintain a structured, categorized feel.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop to preserve the integrity of editorial compositions, shifting to a fluid model on mobile.

- **Grid:** A 12-column grid with generous 24px gutters. 
- **Vertical Rhythm:** Use aggressive vertical spacing (`stack-xl`) between major sections to allow the imagery to "breathe," simulating the experience of turning a magazine page.
- **Asymmetry:** Encourage asymmetrical placements. For example, a headline may span columns 1-8 while the supporting imagery sits in columns 6-12, creating a sophisticated overlapping effect.
- **Mobile:** On mobile, margins tighten to 20px, and typography scales down significantly to ensure the high-contrast "look" remains legible without excessive scrolling.

## Elevation & Depth
Depth in this design system is achieved through **Soft Dramatic Shadows** and **Tonal Layers**, rather than traditional shadows.

1.  **Tonal layering:** Objects are elevated by moving from Midnight Black (#050505) to Charcoal Silk (#1C1C1C).
2.  **Shadows:** When used, shadows must be ultra-diffused and large (e.g., 40px blur, 5% opacity), creating a "soft box" studio lighting effect rather than a digital drop shadow.
3.  **Texture:** Use a subtle "grain" or "silk noise" overlay on Charcoal Silk surfaces to mimic the texture of fine fabric.
4.  **Glassmorphism:** Use sparingly for navigation bars with a high-strength blur (30px+) and a very low opacity (10%) Pearl White tint to simulate frosted glass shelving found in luxury boutiques.

## Shapes
The shape language is **Sharp (0)**. To maintain the high-fashion editorial feel, all containers, buttons, and image frames must have 0px corner radii. 

Precision is paramount. Sharp corners convey a sense of tailored discipline and architectural rigor. Roundness is only permitted for organic elements like photography or specific icon sets, never for structural UI components.

## Components
- **Buttons:** Primary buttons are Champagne Silk with Midnight Black text, using the `label-caps` typography. They should have no border, but a 1px "ghost" outline of Pearl White on hover.
- **Input Fields:** Minimalist 1px bottom-border only (Pearl White). Labels sit above the line in `label-caps`. 
- **Cards:** Editorial-style cards with full-bleed imagery. Text overlays should use `Bodoni Moda` and be placed in high-contrast "safe zones" created by subtle linear gradients at the base of the image.
- **Chips/Tags:** Small, sharp-edged boxes with 1px Pearl White borders. Text is always `label-caps`.
- **Lists:** Separated by thin 0.5px Pearl White lines. Hover states trigger a subtle transition to Charcoal Silk background.
- **Fashion Progress Bar:** For multi-step processes, use an ultra-thin (1px) line that grows in Champagne Silk, with numeric markers in `Bodoni Moda`.