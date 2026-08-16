# Dawati Interactive Invitation Experience: Product Specification (v1)

This document defines the user journey and states for the Dawati Guest Invitation Experience, a premium mobile-web application accessed via private link.

## 1. Journey States

### State 0: Invitation Cover (The Envelope)
- **Visuals**: Ultra-minimal, high-fashion cover.
- **Content**: 
  - "دعوة زفاف" (Wedding Invitation)
  - Couple Names: "SARA & MOHAMMED" (English)
  - Call-to-Action: "اضغط لفتح الدعوة" (Tap to open)
- **Interaction**: Tapping initiates the "Open Reveal" animation.

### State 1: The Reveal (Opening Animation)
- **Mechanism**: Layered transition using CSS transforms/opacity.
- **Visuals**: The cover slides apart or fades, revealing the architectural invitation background and content.

### State 2: Main Invitation Card
- **Layout**: Continuous vertical scroll.
- **Sections**:
  - **The Couple**: SARA & MOHAMMED (Monogram/Hero)
  - **The Personalization**: "إلى أم فلان" (Addressed to the guest)
  - **The Details**: Date (Hijri/Gregorian), Time, and interactive Location button.
  - **The Countdown**: Live dynamic countdown to the event.

### State 3: Interaction (RSVP)
- **Action**: "أوافق على الحضور" (Confirm) vs "أعتذر" (Decline).
- **Logic**:
  - **Confirm**: Triggers "State 4: Confirmation & Entry Card".
  - **Decline**: Triggers "State 5: Respectful Apology".

### State 4: Entry Card (Post-Confirmation)
- **Visuals**: Reverses the card to show a "Digital Ticket" aesthetic.
- **Content**: 
  - Guest Name: أم فلان
  - Capacity: "عدد الأشخاص المسموح: 3 أشخاص"
  - Unique QR Code (Integrated elegantly).
  - Status Indicator: "دعوة صالحة" (Valid).

### State 5: Apology State
- **Content**: "تم تسجيل اعتذارك. شكرًا لتواصلك معنا."

## 2. Design Language
- **Palette**: Warm Ivory, Champagne, Espresso, Muted Burgundy.
- **Typography**: Playfair Display (English names), Premium Naskh/Kufi (Arabic UI).
- **Hierarchy**: Couple Names > Guest Name > RSVP > Details.
- **RTL**: Primary alignment for all Arabic UI elements.