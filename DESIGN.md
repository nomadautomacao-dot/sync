# Design System — Sync

## Visual Theme

- **Mode**: Light (primary), with dark sidebar navigation
- **Register**: Product (dashboard/tool UI)
- **Color Strategy**: Restrained (tinted neutrals + navy accent ≤10%)
- **Energy**: Professional, institutional, calm

## Color Palette (OKLCH-inspired)

### Foundation
| Token | Hex | Role |
|---|---|---|
| `scaffold` | `#EEF1F6` | Page background |
| `cardWhite` | `#FFFFFF` | Card/panel surface |
| `borderLight` | `#E2E8F0` | Subtle borders |

### Text Hierarchy
| Token | Hex | Role |
|---|---|---|
| `textTitle` | `#111827` | H1-H3, primary labels |
| `textBody` | `#374151` | Body text, descriptions |
| `textMuted` | `#6B7280` | Secondary labels, metadata |
| `textDim` | `#9CA3AF` | Placeholders, disabled |

### Primary (Rocha Prime Navy)
| Token | Hex | Role |
|---|---|---|
| `primary` | `#1B2A4A` | Buttons, navigation active, links |
| `primaryLight` | `#E8EBF2` | Selected state backgrounds |
| `primaryDim` | `#7084AB` | Hover states, secondary actions |

### Semantic Status
| Token | Hex | Role |
|---|---|---|
| `success` | `#10B981` | Active, completed, positive |
| `warning` | `#F59E0B` | Attention, pending, review |
| `error` | `#EF4444` | Error, critical, failed |

### Accent (Dark Sidebar — SyncPalette)
| Token | Hex | Role |
|---|---|---|
| `bgPrimary` | `#04070C` | Deep sidebar background |
| `bgSecondary` | `#0A111A` | Sidebar elevated |
| `bgElevated` | `#111823` | Sidebar hover |
| `bgSurface` | `#17202D` | Sidebar cards |
| `statusInfo` | `#4EA1FF` | Info badge, link |
| `statusPurple` | `#7C8BFF` | Alt status |
| `accentHover` | `#2F6BFF` | Active indicator |

## Typography

- **Family**: Inter (Google Fonts)
- **Fallback**: system-ui, sans-serif
- **Scale** (1.125 ratio):

| Level | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `headlineMedium` | 36sp | 700 | -1.4 | Page titles |
| `headlineSmall` | 22sp | 700 | -0.6 | Section headers |
| `titleLarge` | 18sp | 600 | -0.3 | Card titles |
| `titleMedium` | 15sp | 600 | -0.15 | Field groups |
| `bodyLarge` | 15sp | 400 | 0 | Body text |
| `bodyMedium` | 14sp | 400 | 0 | Secondary text |
| `bodySmall` | 12sp | 500 | 0 | Labels, metadata |
| `labelLarge` | 13sp | 600 | 0.05 | Buttons, chips |
| `labelSmall` | 11sp | 600 | 0.8 | Overline, badges |

## Spacing

- Base unit: 4dp
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64
- Card internal padding: 16-24dp
- Section gaps: 24-32dp
- Input field height: 48dp (touch-friendly)

## Elevation

- **No shadows on cards**. Using 1px borders (`borderLight`) instead.
- Sidebar uses flat color differentiation, no elevation.
- Modal overlays: scrim at 8% black opacity

## Corner Radius

- Cards: 12dp
- Buttons: 10dp  
- Inputs: 10dp
- Chips: 8dp
- Badges: full (pill)

## Components

### Buttons
- Primary: Navy fill, white text, 48dp min height
- Secondary: Outlined, navy text, 48dp min height
- Text: No border, primary color text

### Cards
- White background, 1px border, no shadow
- 12dp radius
- Zero margin (managed by parent layout)

### Inputs
- Outlined style, no fill
- Focus: primary color border 1.5px
- Error: red border 1.5px

### Navigation
- Desktop: Fixed sidebar (292dp) + top header
- Mobile: Drawer (304dp) + hamburger
- Sidebar: Dark theme (SyncPalette)
- Active indicator: `accentHover` (#2F6BFF) left strip

### Status Indicators
- Tags/chips with semantic colors
- Consistent across all screens
- States: success/active (green), warning (amber), error (red), info (blue)

## Improvements Needed

1. **Skeleton loading states**: Replace spinners with shimmer/skeleton placeholders
2. **Empty states**: Add illustrations + action CTAs when lists are empty
3. **Micro-transitions**: 200ms ease-out on page changes, card hover
4. **Consistent spacing rhythm**: Some screens have inconsistent gaps
5. **Data density**: Tables and cards could use tighter spacing for data-heavy views
6. **Focus states**: Missing keyboard focus indicators on many inputs
7. **Color accent consistency**: `accentHover` vs `statusInfo` overlap — clarify roles
