# Design System - Handwritten Notebook Aesthetic

Inspired by creative studio aesthetics, this design creates a warm, productive workspace feel.

## Design Principles

### 1. **Paper Notebook Feel**
- Background: Cream/off-white paper texture (`paper-100`)
- Subtle horizontal lines like notebook paper
- Slight rotation on elements for organic, hand-placed feel

### 2. **Handwritten Typography**
- **Headings**: Caveat font (handwritten, playful)
- **Body**: Comic Neue (friendly, readable)
- **Code**: Courier Prime (typewriter aesthetic)

### 3. **Colors**
Warm, creative palette inspired by art studios:
- **Paper tones**: `#fffef9` to `#fdf5d9`
- **Ink**: `#2d2d2d` (charcoal) and `#1a1a1a` (black)
- **Accents**:
  - Yellow: `#FFB84D` (sunshine, energy)
  - Orange: `#FF8C42` (warmth, creativity)
  - Pink: `#FF6B9D` (playfulness)
  - Blue: `#4ECDC4` (calm, trust)
  - Green: `#95E1D3` (growth, nature)

### 4. **Hand-Drawn Elements**
- **Buttons**: Slight rotation, hard shadow on hover (3D paper effect)
- **Cards**: Bold borders, shadow, slight rotation, decorative tape
- **Inputs**: Rotated slightly, lined paper texture in textareas
- **Tabs**: Hand-drawn underline animation

### 5. **Decorative Details**
- ✨ **Sketch underlines**: Yellow highlight effect on headings
- 📌 **Washi tape**: Colored tape strips on cards
- ⭐ **Stars & doodles**: Decorative elements throughout
- 🎨 **Emojis**: Used intentionally for visual interest

## Component Styles

### Buttons
```
- Hand font, larger text (18px)
- 2px solid border
- Slight rotation (-0.5deg)
- Hard shadow on hover (4px offset)
- Pressed state (no shadow, no transform)
```

### Cards
```
- White background
- 2px solid border
- 12px border radius
- 6px hard shadow
- Decorative tape accent (top-left)
- Slight rotation (-0.2deg)
```

### Inputs & Textareas
```
- Hand font for inputs
- Lined paper background for textareas
- 2px borders
- Slight rotation (-0.3deg)
- Blue accent ring on focus
```

### Tabs
```
- Hand font, large (20px)
- Emojis for visual interest
- Hand-drawn underline animation
- Orange accent color when active
```

## Layout Features

### Header
- Large handwritten title with sketch underline
- Star icon (rotated)
- Decorative tape element
- Friendly tagline

### Background
- Subtle horizontal lines (notebook paper)
- Cream/beige color (#fffcf0)
- Creates warm, approachable atmosphere

### Spacing
- Generous whitespace
- Asymmetric, organic placement
- Elements slightly rotated for handmade feel

## Mood & Psychology

**Goal**: Boost productivity through pleasing aesthetics

**How it works**:
1. **Warmth**: Cream background reduces eye strain vs stark white
2. **Personality**: Handwritten fonts feel friendly, less intimidating
3. **Playfulness**: Slight rotations and decorative elements add delight
4. **Creativity**: Art studio aesthetic encourages creative thinking
5. **Calm**: Soft colors and organic shapes reduce stress

## Implementation Notes

- All rotations are subtle (0.2-1 degree) to avoid looking messy
- Hard shadows (no blur) for hand-drawn paper cutout effect
- Animations are smooth but not distracting
- Responsive design maintains aesthetic on all screen sizes
- Color contrast meets WCAG accessibility standards

## Font Loading
```html
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Patrick+Hand&family=Comic+Neue:wght@300;400;700&family=Courier+Prime:wght@400;700&display=swap">
```

## Color Palette Reference

```css
paper-50:  #fffef9  (lightest cream)
paper-100: #fffcf0  (main background)
paper-200: #fef9e7  (card tint)
paper-300: #fdf5d9  (darker accent)

ink-100:   #2d2d2d  (main text)
ink-200:   #1a1a1a  (headings)

accent-yellow:  #FFB84D
accent-orange:  #FF8C42
accent-pink:    #FF6B9D
accent-blue:    #4ECDC4
accent-green:   #95E1D3
```

## Usage

Open `http://localhost:3000` to see the design in action. The aesthetic creates a delightful, productive workspace that makes using the LLM tool feel less like work and more like creative collaboration.
