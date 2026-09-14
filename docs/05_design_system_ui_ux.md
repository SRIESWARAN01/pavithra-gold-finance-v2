# 05. Design System & UI/UX Guidelines

---

## 13. UI/UX Guidelines

Pavithra Gold Finance (PGF) is designed under the philosophy of **"Luxury Financial Security."** The application departs from typical database entry interfaces, shifting toward the aesthetic standards of premium private wealth platforms.

### 13.1 Design Principles
1. **Absolute Clarity**: Financial terms, outstanding numbers, and payment splits must be highly prominent. There should be no doubt about what is owed.
2. **High-Contrast Dark Mode**: The interface defaults to dark theme aesthetics, employing a deep navy backdrop and gold highlights to reduce eye strain during long working hours (for Admin) and invoke exclusivity (for Customer).
3. **Intentional Micro-Animations**: Interactivity is supported by transitions (e.g., hover scaling, slide-out panels, gold border glows) to make the experience feel smooth and native.

---

## 14. Design System

Built on top of **Tailwind CSS** and **Shadcn UI** tokens, this design system uses utility classes mapped to CSS variables for unified theme control.

---

## 15. Color Palette

The palette is composed of luxurious deep navy, bright gold, and clean neutral elements.

```
+-------------------------------------------------------------+
| BACKGROUND (Deep Navy): #0A192F | HSL(220, 65%, 12%)        |
| PRIMARY (Rich Gold):    #D4AF37 | HSL(46, 65%, 52%)         |
| SECONDARY (Warm White): #F8FAFC | HSL(210, 40%, 98%)        |
| ACCENT (Deep Gold):     #AA8C2C | HSL(46, 59%, 42%)         |
| MUTED (Slate Gray):     #64748B | HSL(215, 16%, 47%)        |
+-------------------------------------------------------------+
```

### 15.1 Tailwind Configuration Integration
```typescript
theme: {
  extend: {
    colors: {
      navy: {
        DEFAULT: '#0A192F',
        darker: '#020C1B',
        light: '#172A45',
      },
      gold: {
        DEFAULT: '#D4AF37',
        dark: '#AA8C2C',
        light: '#F3E5AB',
      },
      neutral: {
        background: '#F8FAFC',
        text: '#0F172A',
        card: '#112240',
      }
    }
  }
}
```

---

## 16. Typography

We enforce the use of premium geometric and humanistic sans-serif fonts to maintain a sleek, technical, yet readable presentation.

* **Primary Font (Headings, Stats, Metrics)**: `Outfit` (Google Fonts)
  * Represents modernism and clean financial interfaces.
* **Secondary Font (Body Text, Forms, Tables)**: `Inter` (Google Fonts)
  * Provides legibility even at small sizes (e.g., table cells).

### 16.1 Type Hierarchy Scale
* **H1 (Hero Metrics, Section Headers)**: `font-outfit font-bold text-3xl tracking-tight` (30px)
* **H2 (Card Headers, Form Steps)**: `font-outfit font-semibold text-xl tracking-normal` (20px)
* **H3 (Table Headers, Label Caps)**: `font-outfit font-medium text-sm uppercase tracking-wider` (14px)
* **Body Regular (Descriptions, Fields)**: `font-inter font-normal text-base text-slate-300` (16px)
* **Small / Caption (Remarks, Timestamps)**: `font-inter font-light text-xs text-slate-500` (12px)

---

## 17. Icons

We standardize exclusively on **Lucide React** to ensure visual consistency and crisp vector rendering.

* **Navigation**: `LayoutDashboard`, `UserSquare2`, `Coins`, `Receipt`, `Settings`
* **Actions**: `Plus`, `Search`, `Trash2`, `UploadCloud`, `CheckCircle2`, `Camera`
* **Indicators**: `Calendar`, `AlertTriangle`, `TrendingUp`, `ChevronDown`, `Download`

---

## 18. Components (Shadcn UI Standardized)

Every interactive UI element corresponds directly to customized Shadcn UI components.

### 18.1 Primary Button (Gold Variant)
* **CSS Class**: `bg-gold hover:bg-gold-dark text-navy-DEFAULT font-outfit font-semibold transition-all duration-300 ease-in-out px-4 py-2 rounded-md shadow-lg shadow-gold/20`
* **Interaction**: Scales down to `scale-95` on tap.

### 18.2 Secondary Input (Navy Fields)
* **CSS Class**: `bg-navy-light border border-slate-700 text-white placeholder-slate-500 focus:border-gold focus:ring-1 focus:ring-gold rounded-md px-3 py-2 font-inter text-sm`

### 18.3 Financial Card Container
* **CSS Class**: `bg-navy-light/50 backdrop-blur-md border border-gold/10 hover:border-gold/30 rounded-xl p-6 transition-all duration-500 shadow-xl`

---

## 19. Layout System

* **Admin Portal Layout**:
  * Fixed Left Sidebar (260px wide, dark navy, gold brand logo, list of links).
  * Top bar (height 70px, floating search bar, admin avatar).
  * Main Content Canvas (fill remaining width, scrollable, max-width container).
* **Customer Mobile Layout**:
  * Top Header (height 60px, brand badge, notifications bell).
  * Main Canvas (full screen, padding 16px, bottom-padding 80px).
  * Bottom Navigation Dock (fixed at bottom, height 65px, blur-backdrop, contains 4 core action tabs).

---

## 20. Responsive Behaviour

PGF is designed for cross-device fluidity.

| Breakpoint | Target View | Layout Adaptation |
|---|---|---|
| **Mobile (`<640px`)** | Customer Portal | Dashboard cards stack vertically. Tables transform into scrollable list-cards. Signature pad occupies 100% width. |
| **Tablet (`640px - 1024px`)** | Appraiser iPad / Touch | Sidebar collapses into a hamburger overlay. Grid columns adjust from 4 items to 2 items. |
| **Desktop (`>1024px`)** | Backoffice Monitors | Full persistent layouts. Multi-column forms, split view screen workflows, and side-by-side data tables. |
