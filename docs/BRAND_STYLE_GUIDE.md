# AskMyFarm Brand Style Guide

**Version:** 1.0  
**Last Updated:** October 2024  
**Platform:** Mobile Web Application (PWA)

---

## 📋 Table of Contents

1. [Brand Overview](#brand-overview)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Logo & Brand Name](#logo--brand-name)
5. [Icons & Graphics](#icons--graphics)
6. [Component Styles](#component-styles)
7. [Gradients & Effects](#gradients--effects)
8. [Code Reference](#code-reference)
9. [Usage Examples](#usage-examples)

---

## 🌾 Brand Overview

**AskMyFarm** is a mobile-first Progressive Web App that transforms voice notes into actionable farm intelligence. The brand identity reflects:

- **Agriculture & Growth**: Farm Green primary color representing agriculture and growth
- **Innovation**: AI-powered features with modern, clean design
- **Accessibility**: Dark-first theme optimized for outdoor mobile use
- **Trust**: Professional yet approachable aesthetic

**Brand Personality:**
- Intelligent & Advanced
- Practical & Reliable
- Agricultural & Grounded
- Modern & Innovative

---

## 🎨 Color Palette

### Primary Brand Colors

#### Farm Green (Primary)
```css
/* HSL Format */
--primary: 142 76% 36%;

/* HEX */
#16a34a

/* RGB */
rgb(22, 163, 74)

/* Usage */
- Primary buttons and CTAs
- Brand elements (logo, accents)
- Interactive elements (links, icons)
- Focus states and active elements
```

#### Farm Green Light (Accent)
```css
/* HSL Format */
--ring: 142 71% 45%;

/* HEX */
#22c55e

/* RGB */
rgb(34, 197, 94)

/* Usage */
- Focus rings
- Hover states
- Gradient highlights
- Success states
```

#### Yellow/Gold (Secondary Accent)
```css
/* HEX */
#facc15 (yellow-400)

/* Usage */
- "My" in AskMyFarm logo
- Highlight elements
- Warning states (contextual)
- Call-out badges
```

---

### Dark Theme Colors (Primary)

#### Background Colors
```css
/* Main Background */
--background: 215 25% 27%;    /* #1F2937 - Gray 800 */

/* Card/Panel Background */
--card: 215 28% 24%;          /* #374151 - Gray 700 */

/* Input Background */
--input: 215 28% 24%;         /* #374151 - Gray 700 */

/* Accent Background */
--accent: 215 28% 24%;        /* #374151 - Gray 700 */
```

#### Text Colors
```css
/* Primary Text */
--foreground: 210 20% 98%;           /* #F9FAFB - Gray 50 */

/* Muted Text */
--muted-foreground: 218 11% 65%;     /* #9CA3AF - Gray 400 */

/* Primary on White */
--primary-foreground: 0 0% 100%;     /* #FFFFFF */
```

#### Border & Divider Colors
```css
/* Standard Border */
--border: 215 20% 34%;        /* #4B5563 - Gray 600 */

/* Card Border */
Same as --border
```

#### Status Colors
```css
/* Success (uses primary green) */
--primary: 142 76% 36%;       /* #16a34a */

/* Error/Destructive */
--destructive: 0 84% 60%;     /* #ef4444 - Red 500 */

/* Warning (contextual) */
Use yellow-400: #facc15
```

---

### Light Theme Colors (Secondary)

> Note: App is dark-first, but light theme available for future use

```css
--background: 0 0% 100%;              /* White */
--foreground: 142 30% 15%;            /* Dark Green */
--primary: 142 70% 35%;               /* Farm Green */
--secondary: 40 80% 55%;              /* Yellow */
--border: 142 20% 90%;                /* Light Green Gray */
```

---

## 📝 Typography

### Font Stack

```css
/* Default System Font Stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 
             'Helvetica Neue', Arial, sans-serif;
```

### Type Scale

#### Page Titles
```css
.page-title {
  font-size: 1.875rem;     /* 30px */
  font-weight: 700;        /* Bold */
  line-height: 1.2;
  color: var(--foreground);
}
```

**Usage:** Main page headings, hero titles

#### Page Subtitles
```css
.page-subtitle {
  font-size: 1.125rem;     /* 18px */
  font-weight: 400;        /* Regular */
  line-height: 1.75;
  color: var(--muted-foreground);
  max-width: 32rem;
}
```

**Usage:** Descriptive text under page titles

#### Section Headings
```css
.section-heading {
  font-size: 1.25rem;      /* 20px */
  font-weight: 600;        /* Semibold */
  line-height: 1.4;
  color: var(--foreground);
  margin-bottom: 1rem;
}
```

**Usage:** Section headers within pages

#### Card Titles
```css
.card-title {
  font-size: 1rem;         /* 16px */
  font-weight: 600;        /* Semibold */
  line-height: 1.5;
  color: var(--foreground);
  margin-bottom: 0.25rem;
}
```

**Usage:** Titles within cards, list items

#### Body Text
```css
.body-text {
  font-size: 0.875rem;     /* 14px */
  font-weight: 400;        /* Regular */
  line-height: 1.75;
  color: var(--muted-foreground);
}
```

**Usage:** Standard paragraph text, descriptions

#### Label Text
```css
.label-text {
  font-size: 0.75rem;      /* 12px */
  font-weight: 500;        /* Medium */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
}
```

**Usage:** Form labels, metadata, category tags

---

## 🏷️ Logo & Brand Name

### Logo Typography Treatment

```tsx
<h1 className="page-title">
  <span className="text-primary">Ask</span>
  <span className="text-yellow-400">My</span>
  <span className="text-primary">Farm</span>
</h1>
```

**Colors:**
- **Ask** → Farm Green (#16a34a)
- **My** → Yellow (#facc15)
- **Farm** → Farm Green (#16a34a)

### Logo Icon

**Primary Icon:** 🌾 (Wheat Sheaf)

**Usage:**
- Welcome/landing page
- Favicon
- PWA app icon
- Empty states

### App Icon Specifications

**Sizes Available:**
- 72x72px, 96x96px, 128x128px, 144x144px
- 152x152px, 192x192px, 384x384px, 512x512px

**Format:** PNG + SVG
**Background:** Farm Green (#16a34a)
**Icon Color:** White

---

## 🎨 Icons & Graphics

### Icon Container Styles

#### Large Brand Icon
```css
.icon-brand {
  width: 80px;
  height: 80px;
  border-radius: 16px;
  background: var(--primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

**Usage:** App logo, major feature icons

#### Medium Feature Icon
```css
.icon-feature {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: var(--primary) / 10%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-feature-svg {
  width: 24px;
  height: 24px;
  color: var(--primary);
}
```

**Usage:** Feature highlights, action buttons

#### Small Icon
```css
.icon-small {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--primary) / 10%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-small-svg {
  width: 20px;
  height: 20px;
  color: var(--primary);
}
```

**Usage:** List items, cards, inline icons

#### Tiny Icon
```css
.icon-tiny {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--primary) / 10%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-tiny-svg {
  width: 16px;
  height: 16px;
  color: var(--primary);
}
```

**Usage:** Badges, small indicators

### Icon Library

**Primary Icons (Lucide React):**
- `Mic` - Voice recording
- `Sparkles` - AI features
- `Brain` - Farm Memory
- `Sprout` - Prescriptions
- `BarChart3` - Field plans
- `FileText` - Documents
- `Camera` - Photos
- `Search` - Search functionality

---

## 🔲 Component Styles

### Cards

#### Standard Card
```css
.card-standard {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  transition: background 0.2s;
}

.card-standard:hover {
  background: var(--accent);
}
```

#### Interactive Card
```css
.card-interactive {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.card-interactive:hover {
  background: var(--accent);
}

.card-interactive:active {
  transform: scale(0.98);
}
```

#### Feature Card
```css
.card-feature {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
```

### Buttons

#### Primary Button
```tsx
<Button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Get Started
</Button>
```

#### Secondary/Outline Button
```tsx
<Button 
  variant="outline"
  className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/20"
>
  Learn More
</Button>
```

#### Ghost Button
```tsx
<Button variant="ghost" className="text-primary hover:bg-primary/10">
  Cancel
</Button>
```

#### Destructive Button
```tsx
<Button 
  variant="destructive"
  className="bg-destructive text-destructive-foreground"
>
  Delete
</Button>
```

### Inputs & Forms

```css
/* Input Fields */
.input {
  background: var(--input);
  border: 1px solid var(--border);
  color: var(--foreground);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
}

.input:focus {
  outline: none;
  ring: 2px solid var(--ring);
  border-color: var(--ring);
}
```

---

## ✨ Gradients & Effects

### Brand Gradients

#### Hero Gradient
```css
--gradient-hero: linear-gradient(135deg, #16a34a 0%, #22c55e 100%);
```

**Usage:** Landing pages, hero sections, major CTAs

#### Card Gradient
```css
--gradient-card: linear-gradient(180deg, #374151 0%, #1F2937 100%);
```

**Usage:** Elevated cards, panel backgrounds

#### Page Background Gradient
```css
.page-background {
  background: linear-gradient(
    to bottom,
    hsl(var(--primary) / 0.05) 0%,
    hsl(var(--background)) 100%
  );
}
```

#### Page Background Hero
```css
.page-background-hero {
  background: linear-gradient(
    135deg,
    hsl(var(--primary) / 0.08) 0%,
    hsl(var(--background)) 50%,
    hsl(var(--primary) / 0.03) 100%
  );
}
```

### Shadows

```css
/* Elevated Shadow (Dialogs, Modals) */
--shadow-elevated: 0 4px 24px -4px rgba(0, 0, 0, 0.3);

/* Card Shadow */
--shadow-card: 0 2px 12px -2px rgba(0, 0, 0, 0.2);
```

### Animations

```css
/* Fade In */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Scale on Active */
.active\:scale-98:active {
  transform: scale(0.98);
}
```

---

## 💻 Code Reference

### CSS Variables Location

**File:** `src/index.css`

All color and design tokens are defined as CSS custom properties:

```css
:root {
  --background: 215 25% 27%;
  --foreground: 210 20% 98%;
  --primary: 142 76% 36%;
  /* ... etc */
}
```

### Tailwind Configuration

**File:** `tailwind.config.ts`

Extended colors, animations, and utilities are configured here.

### Component Library

**UI Components:** `src/components/ui/`

Built with shadcn/ui (Radix UI + Tailwind CSS)

---

## 📚 Usage Examples

### Hero Section (Welcome Page)

```tsx
<div className="page-background-hero min-h-screen flex items-center justify-center px-6">
  <div className="text-center space-y-8">
    <div className="icon-brand mx-auto">
      <span className="text-6xl">🌾</span>
    </div>
    
    <h1 className="page-title">
      <span className="text-primary">Ask</span>
      <span className="text-yellow-400">My</span>
      <span className="text-primary">Farm</span>
    </h1>
    
    <p className="page-subtitle">
      Your farm's digital memory. Plan smarter, collaborate better, 
      execute seamlessly.
    </p>
    
    <Button className="bg-primary hover:bg-primary/90">
      Get Started
    </Button>
  </div>
</div>
```

### Feature Card

```tsx
<div className="card-feature">
  <div className="icon-small">
    <Sparkles className="icon-small-svg" />
  </div>
  <div>
    <h3 className="card-title">Smart Field Plans</h3>
    <p className="body-text">
      Zone-based prescription generation with seamless John Deere integration
    </p>
  </div>
</div>
```

### Search Input with Brand Styling

```tsx
<div className="relative bg-gradient-to-r from-primary/10 to-primary/5 
                border-2 border-primary/30 rounded-xl shadow-lg">
  <Search className="absolute left-4 top-1/2 -translate-y-1/2 
                     h-6 w-6 text-primary" />
  <Input
    placeholder="Search farm memory..."
    className="pl-12 h-14 bg-transparent border-none"
  />
</div>
```

### Primary CTA Button

```tsx
<Button 
  className="w-full bg-primary hover:bg-primary/90 
             text-primary-foreground font-semibold h-12"
>
  <Mic className="w-5 h-5 mr-2" />
  Start Recording
</Button>
```

### Secondary/Outline Button

```tsx
<Button
  variant="outline"
  className="w-full bg-primary/10 hover:bg-primary/20 
             text-primary border-primary/20"
>
  Choose from Gallery
</Button>
```

---

## 🎯 Design Principles

### Mobile-First
- Touch-friendly tap targets (minimum 44x44px)
- Clear visual hierarchy
- Thumb-friendly navigation

### Dark-First
- Optimized for outdoor use
- Reduced eye strain
- Better battery life on OLED screens

### Accessible
- WCAG AA color contrast ratios
- Clear focus states
- Screen reader friendly

### Performance
- Minimal animations
- Optimized images
- Progressive enhancement

---

## 📱 Platform-Specific Considerations

### PWA Manifest

**Theme Color:** `#16a34a` (Primary Green)
**Background Color:** `#0f172a` (Dark Slate)

### Safe Areas (iOS)

```css
/* Account for notch/home indicator */
padding-bottom: env(safe-area-inset-bottom);
padding-top: env(safe-area-inset-top);
```

---

## 🔄 Version History

**v1.0** - October 2024
- Initial brand style guide
- Dark-first mobile theme
- Farm Green primary color system
- Component library documentation

---

## 📞 Contact & Support

For brand guidelines questions or design system updates, please contact the development team.

**Live Application:** [https://askmyfarm.us](https://askmyfarm.us)

---

**Built with ❤️ for modern agriculture**

