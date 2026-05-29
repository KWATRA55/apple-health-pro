# Elite Health AI — UI Design Specification & Handoff Document

> **Purpose**: Complete handoff document for a UI/UX designer. Covers every screen, every computed metric shown to the user, the design system tokens, and the user flow. No engineering knowledge required.

---

## 🎯 Product Identity

**Elite Health AI (KILO AI V2)** is a premium, OLED dark-mode mobile application for high-performance longevity and sports science. Think of it as a **Whoop/Fitbit/Oura competitor with an AI coach** — it takes raw biometric data from Apple Watch/HealthKit and runs it through professional sports-science algorithms to give users actionable insights about their body.

**Platform**: React Native (Expo) — mobile-first, targeting iOS.

---

## 📱 Screen Inventory & Navigation Map

```
┌─────────────────────────────────────────────────────────────────┐
│  TAB BAR (Bottom Navigation)                                     │
│  [Home]   [Health]   [Coach]   [Profile]                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PUSH DRILLDOWNS (navigated from tabs)                           │
│  ├── Sleep Architecture (date param)                             │
│  ├── Weekly Summary (week offset param)                          │
│  └── Monthly Summary (month offset param)                        │
│                                                                  │
│  MODALS (overlays)                                               │
│  └── Safety Intercept Modal (critical biometric alerts)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ SCREEN 1: Home Dashboard (`index.tsx`)

**Purpose**: The primary dashboard — gives the user an at-a-glance view of their health state, a procedural 3D visual, a daily AI command, and three pillar scores.

### Components (top-to-bottom)

#### 1. Date Selector Header
- Displays: `◀ TODAY ▶` (or `◀ MAY 21 ▶` for past dates)
- Left/Right arrows allow scrolling through historical dates
- Selecting a past date hydrates the entire dashboard from cached local data
- When viewing "Today", the label says "Today"; otherwise shows formatted date

#### 2. Longevity Sphere (3D Procedural Morphing Orb)
- **What it is**: A GPU-animated procedural shape (not a static image) — uses SVG + React Native Reanimated to create an organic, breathing orb
- **What it shows**: The user's **Pace of Aging** as a percentage label inside the sphere:
  - `15.0% REVERSING` (teal/cyan colors, slow majestic morphing)
  - `3.2% SLOWER` (green colors, moderate morphing)
  - `0.8% FASTER` (amber colors, faster morphing)
  - `12.5% ACCELERATING` (red colors, fast erratic morphing)
- **Visual layers**:
  - Concentric SVG circles with subsurface scattering simulation
  - Inner core bright highlight
  - Mid-layer in biometric color (green/yellow/red)
  - Outer dark shell with Fresnel-like rim light
  - Specular highlight ellipse
  - Soft elliptical shadow beneath
  - Orbiting starfield particles
  - Glow pulsation tied to recovery zone (green=gentle, amber=moderate, red=intense)
- **Data binding**: Speed, color, and pulse amplitude all bound to Pace of Aging score

#### 3. Daily Directive Card
An elevated glassmorphic card displaying:
| Field | Example | Description |
|-------|---------|-------------|
| Headline | `CNS OVERLOAD` or `ALL SYSTEMS NOMINAL` | Dynamic status label |
| Command | *"Target 8:30 PM bedtime. No training today."* | AI-generated actionable sentence |
| Today's Limit | `12.8` | Target Strain (0–21.0 scale) — how hard the user should train today |
| Bedtime | `8:30 PM` | AI-calculated optimal bedtime based on sleep debt/stress |
| Recovery Tip | *"4-7-8 breathing, 5 min"* | Actionable physical protocol |

#### 4. Bento Grid — Three Pillar Cards
Three interactive pressable tiles, each showing:
| Pillar | Glow Color | What it measures | Score Range | Zone Labels |
|--------|-----------|-------------------|-------------|-------------|
| **Readiness** | Teal `#14B8A6` | Autonomic nervous system reserve (HRV, RHR, sleep) | 0–100 | PRIMED (≥75) / MODERATE / DEPLETED (≤40) |
| **Resilience** | Purple `#A855F7` | Immune system + biomechanics + CNS defenses | 0–100 | ROBUST (≥75) / GUARDED / FRAGILE (≤35) |
| **Longevity** | Cyan `#00E5FF` | Aging pace, VO2 Max, gait health | 0–100 | REJUVENATING (≥75) / NEUTRAL / ACCELERATING (≤35) |

Each card shows:
- Score number (large)
- Zone label (e.g., "PRIMED", "GUARDED")
- Primary metric value (varies per pillar)
- Glow ring visualization

#### 5. Activity Timeline
Scrollable list of logged workouts showing:
- Workout type (Running, HIIT, Strength, Cycling, etc.)
- Active calories burned
- Duration in minutes
- Strain score achieved (color-coded bar)

#### 6. Correlation Explorer ("What's Affecting You")
Shows top 3 discovered correlations between lifestyle habits and biometrics:
- Habit name (e.g., "Evening Workouts", "Morning Sunlight", "Alcohol")
- Impact direction (↑ positive or ↓ negative)
- Impact percentage (e.g., "+12% recovery", "-8% sleep duration")
- Correlation strength badge (Strong / Moderate / Weak)

#### 7. Weekly Planner Card
Horizontal scroll strip showing next 7 days with:
- Day abbreviation (MON, TUE, WED...)
- Recommended strain target (mini progress bar)
- Workout type icon
- Bedtime indicator

#### 8. AI Prompt Bar
Floating input docked above the tab bar:
- "Ask KILO" placeholder text
- Typing a question and hitting send navigates to the Coach tab preloaded with the query

#### 9. Safety Intercept Modal (Overlay)
Triggered when critical biometric thresholds are breached. Types:
| Trigger | Icon | Severity | When it fires |
|---------|------|----------|---------------|
| `workout_block` | ⚠️ | Critical | Biomechanical injury risk is HIGH — blocks impact training |
| `rest_mandate` | 🛌 | Critical | CNS Stress HIGH or Readiness DEPLETED — mandates rest |
| `sleep_prescription` | 🌙 | Critical | Sleep debt > 2 hours or Readiness/Resilience critical |
| `hydration_alert` | ☀️ | Warning | High audio exposure + low daylight (circadian disruption) |
| `trend_degradation` | ⚡ | Warning | 3+ days of HRV decline or RHR rise |
| `recovery_erosion` | ⚡ | Critical | Recovery < 50 for 3+ consecutive days |
| `cns_accumulation` | ⚡ | Warning | CNS stress rising across 4+ days |
| `vo2max_alert` | ⚡ | Warning | VO2 Max down > 1.5 points over 14 days |

Each trigger card shows: icon, title, description, severity badge, and action button.

---

## 📊 SCREEN 2: Health Tab (`health.tsx`)

**Purpose**: Deep-dive into raw metrics, biological age, vitals, and running dynamics. Supports "focus" parameter to highlight a specific pillar when navigated from Home.

### Components (top-to-bottom)

#### 1. Focus Badge (conditional)
When navigated with a focus param, shows a colored pill badge:
- `◉ RECOVERY` (Teal) — Readiness focus
- `◆ DEFENSE` (Purple) — Resilience focus
- `● LONGEVITY` (Cyan) — Longevity focus

#### 2. Biological Age Visualizer
Horizontal sliding tracker comparing:
- **Chronological Age** (calendar age) ← left side
- **Biological Age** (cellular health age) → positioned along the slider
- Visual gap between them shows longevity advantage or deficit

#### 3. Health Monitor Strip
Progress checklist showing:
- "5/5 Vitals Stable" or "3/5 Vitals Stable"
- Quick at-a-glance stability indicator

#### 4. High-Resolution Vitals Grid
Five glowing status modules:
| Vital | Unit | Normal Range | Visual |
|-------|------|--------------|--------|
| **HRV** | ms | > 20 | Ring/meter |
| **Resting HR** | bpm | 40–80 | Ring/meter |
| **SpO2** | % | ≥ 95 | Ring/meter |
| **Respiratory Rate** | breaths/min | 8–25 | Ring/meter |
| **Skin Temp Delta** | °C | ±2.0 from baseline | Ring/meter |

Each vitals module shows:
- Current value (large number)
- Unit label
- Color-coded status (in-range green, borderline amber, out-of-range red)

#### 5. Cardiac Strain Progress Bar
Expansive horizontal bar (0–21.0 scale):
- Green: Light exertion (< 5.0)
- Yellow: Moderate exertion (5.0–10.0)
- Orange: High exertion (10.0–14.0)
- Red: Very high exertion (14.0–18.0)
- Intense red: Maximal (18.0–21.0)

#### 6. Running Dynamics Card
Double-column comparison block (Today vs. 14-day average):
| Metric | Unit | What it means |
|--------|------|---------------|
| **Ground Contact Time** | ms | Time foot stays on ground per stride |
| **Running Power** | watts | Mechanical work rate while running |
| **Vertical Oscillation** | cm | Up-down bounce per step |
| **Stride Length** | m | Distance per complete running cycle |

Each shows: current value, delta from baseline, trend arrow

#### 7. Readiness Focus Section (when focus=readiness)
- HRV 7-day trend sparkline
- RHR 7-day trend sparkline
- Recovery score history (bar chart)
- Sleep Duration vs. Need comparison
- ANS Balance meter

#### 8. Resilience Focus Section (when focus=resilience)
- Immunity risk indicator (LOW / ELEVATED / HIGH)
- Injury risk biomechanics breakdown
- CNS stress meter (0–100)
- Audio exposure graph (dB over time)
- Daylight exposure trend (minutes over time)

#### 9. Longevity Focus Section (when focus=longevity)
- Biological Age vs. Chronological Age delta
- Pace of Aging gauge
- VO2 Max trend line
- Double Support gait analysis
- Sleep quality trend

#### 10. Workout History
Cards for each logged exercise session showing:
- Workout type label
- Active calories
- Duration
- Average HR / Max HR
- Strain score

#### 11. Trend Explorer
Statistical block showing detected patterns:
- Recovery cliff detection
- HRV surge / crash alerts
- RHR creep warnings
- Sleep erosion patterns
- Strain accumulation tracking
- CNS fatigue detection
- VO2 Max decline alerts

---

## 💬 SCREEN 3: AI Coach (`coach.tsx`)

**Purpose**: Interactive AI sports scientist chat terminal. The user asks questions about their biometrics and gets personalized coaching responses.

### Components

#### 1. Quick Suggestion Cards (shown when chat is empty)
Four suggestion chips:
- *"Analyze my CNS Fatigue"*
- *"Is my running form off? Check form dynamics."*
- *"Predict my injury risk based on mobility."*
- *"How is my sleep quality and deep sleep trend?"*

#### 2. Chat Message Bubbles
- **User messages**: Right-aligned, glassmorphic style
- **Assistant messages**: Left-aligned, accent-cyan border
- **Loading state**: Animated typing indicator dots
- Messages include structured coaching commands, explanations, and protocols

#### 3. Chat Input Bar
- Anchored to bottom
- Glassmorphic overlay styling
- Disabled while AI is generating a response
- Send button with accent color

#### 4. Vision Camera Button (future/planned)
- Floating action button for meal photo logging
- Floating action button for workout form analysis

**Data sent to AI**: A rich JSON payload including recovery score, strain score, sleep debt, HRV Z-score, RHR Z-score, recovery zone, all vitals, sleep architecture, mobility metrics, running dynamics, and derived risk predictions.

---

## 👤 SCREEN 4: Profile (`profile.tsx`)

**Purpose**: Athlete identity, personal records, activity summaries, historical charts, and data export.

### Components

#### 1. Athlete Identity Panel
- Initials avatar
- Name (editable)
- Count of recorded workouts
- Number of days of database logs
- Journal entry count

#### 2. Personal Records Bento Grid
Three all-time maximum cards:
| Record | What it shows |
|--------|---------------|
| **Max Cardiac Strain** | Highest ever strain score achieved |
| **Longest Sleep** | Highest ever sleep duration |
| **Lowest Recovery** | Lowest recovery anomaly recorded |

#### 3. Insights Navigation
Button links to:
- `→ Weekly Summary` drilldown
- `→ Monthly Summary` drilldown

#### 4. Activity Summary
Categorical list grouped by workout type:
- Sport type (Running, HIIT, Strength, Cycling, etc.)
- Session count
- Average strain per type

#### 5. 7-Day Strain vs. Recovery Chart
Dual horizontal progress bars showing:
- Daily cardiac strain (cyan) — how hard the user worked
- Nightly recovery (green/yellow/red) — how well they restored
- 7-day rolling view

#### 6. Data Export Section
- **CSV Export**: Raw data dump of all health tables
- **PDF Report**: Formatted health summary (future)
- **Share Card**: Summary image for sharing (future)

---

## 😴 SCREEN 5: Sleep Architecture Drilldown (`sleep.tsx`)

**Purpose**: Deep analysis of a specific night's sleep stages.

### Components

#### 1. Sleep Stage Hypnogram
Custom visual chart breaking down:
- **Core Sleep** (light sleep) — minutes and %
- **REM Sleep** — minutes and %
- **Deep Sleep** (slow-wave) — minutes and %
- **Awake Time** — minutes and %

#### 2. Sleep Quality Dashboard
| Metric | Ideal Target | Shows |
|--------|-------------|-------|
| **Sleep Efficiency** | — | % of time in bed actually asleep |
| **REM Ratio** | 22% | Actual vs. ideal |
| **Deep Ratio** | 17% | Actual vs. ideal |
| **Sleep Debt** | 0 hrs | Cumulative 7-day debt |
| **Sleep Need** | 8.0+ hrs | Today's required sleep |
| **Sleep Quality Score** | 0–100 | Composite quality score |

#### 3. 7-Night History
Stacked bar comparison of sleep stages across the last 7 nights.

---

## 📅 SCREEN 6: Weekly Summary (`weekly-summary.tsx`)

**Purpose**: 7-day macroeconomic analysis with trends and AI insights.

### Components

#### 1. Week Offset Header
- `◀ MAY 14–20 ▶` — paginate through historical weeks

#### 2. Mini Sparklines
Four horizontal sparkline arrays:
- **HRV** (7-day trend)
- **RHR** (7-day trend)
- **SpO2** (7-day trend)
- **Sleep Duration** (7-day trend)

#### 3. Strain Bar Chart
- 7 daily columns color-coded by exertion level
- Optimal zone highlighted

#### 4. Recovery Zone Distribution
- Pie or stacked bar showing green/yellow/red day distribution for the week

#### 5. CNS Stress & Daylight Dual Chart
- Side-by-side comparison of CNS stress score vs. daylight exposure minutes

#### 6. Trend & Correlation Explorers
- Statistical patterns detected this week
- Top correlations between habits and biometrics

#### 7. AI Weekly Insight
- A dynamically generated paragraph interpreting the week's physiological data

---

## 📆 SCREEN 7: Monthly Summary (`monthly-summary.tsx`)

**Purpose**: 30-day macro view focusing on slow-moving indicators.

### Components

#### 1. Month Offset Header
- `◀ APRIL 2026 ▶` — paginate through months

#### 2. Recovery Heatmap / Calendar
- 30-day grid where each day is colored by recovery zone (green/yellow/red)
- Visualizes long-term autonomic balance patterns

#### 3. VO2 Max Trend Line
- Line chart showing VO2 Max over 30 days
- Projection line showing estimated future trajectory

#### 4. Biological Age Delta Progression
- How biological age has changed relative to chronological age over the month

#### 5. Cumulative Training Load vs. Recovery Balance
- Dual-axis chart comparing accumulated strain against recovery over 30 days

#### 6. Habit Adherence Tracker
- Based on journal entries, shows habit consistency over the month

---

## 🎨 Design System

### Color Palette

```
┌─────────────────────────────────────────────────────────────┐
│  BASE CANVAS                                                 │
│  ───────────                                                 │
│  OLED Black        #000000    Main background                │
│  obsidian-900      #121214    Card backgrounds               │
│  obsidian-800      #161618    Secondary widgets              │
│  obsidian-700      #18181B    Selectors, list rows           │
│                                                              │
│  BORDERS                                                     │
│  edge-border       rgba(255,255,255,0.05)  Subtle dividers  │
│  border-dim        rgba(255,255,255,0.10)  Card borders      │
│                                                              │
│  TEXT                                                        │
│  white             #FFFFFF     Primary headings              │
│  ice               #FAFAFA     Body text                     │
│  steel             rgba(255,255,255,0.45)  Secondary text   │
│  dim               rgba(255,255,255,0.30)  Tertiary text    │
│                                                              │
│  ACCENTS                                                     │
│  accent-volt       #CCFF00     Strain, high-energy metrics  │
│  accent-cyan       #00E5FF     Coach, vitals, active states  │
│  accent-crimson    #FF3366     Alerts, critical, delete      │
│  accent-amber      #FFB800     Moderate warnings             │
│                                                              │
│  PILLAR COLORS                                               │
│  pillar-readiness  #14B8A6     Teal — Recovery/Readiness    │
│  pillar-resilience #A855F7     Purple — Defense/Resilience   │
│  pillar-longevity  #00E5FF     Cyan — Longevity/Aging       │
│                                                              │
│  STATUS COLORS                                               │
│  zone-green        #30D158     Optimal / Low risk            │
│  zone-yellow       #FFD60A     Moderate / Attention          │
│  zone-red          #FF453A     Critical / High risk          │
│  zone-amber        #FFB800     Warning / Borderline          │
└─────────────────────────────────────────────────────────────┘
```

### Typography

| Style | Font | Use |
|-------|------|-----|
| **Numbers & Headings** | SF Pro Display | Metric values, score numbers, section titles |
| **Body & Guidelines** | Inter | Descriptions, commands, tips, paragraphs |
| **Monospaced** | JetBrains Mono | Data tables, raw biometric values, code-like displays |

### Spacing & Radius

| Token | Value | Use |
|-------|-------|-----|
| Card radius | 16–20px | All card components |
| Modal radius | 16px | Intercept modal |
| Button radius | 12–14px | Action buttons |
| Chip/Badge radius | Full (pill) | Status badges, focus badges |
| Section gap | 16px | Between major sections |
| Content padding | 16–20px | Inside cards |

### Glassmorphism Style

All cards use a consistent glass treatment:
- Background: `rgba(255,255,255,0.03–0.05)` (surface-glass)
- Border: `rgba(255,255,255,0.05–0.08)` (edge-border)
- Subtle backdrop blur effect (where supported)

---

## 📐 All Computed Metrics Shown to User

### Primary Scores (shown on Home)

| # | Metric | Unit/Range | Screen(s) |
|---|--------|-----------|-----------|
| 1 | **Recovery Score** | 0–100% | Home, Health, Profile, Weekly, Monthly |
| 2 | **Strain Score** | 0.0–21.0 | Home, Health, Profile, Weekly |
| 3 | **Target Strain** | 0.0–21.0 | Home (Daily Directive) |
| 4 | **Sleep Quality Score** | 0–100 | Sleep, Health |
| 5 | **Sleep Debt** | hours | Home, Sleep, Health, Coach |
| 6 | **Sleep Need** | hours | Home, Sleep, Health |
| 7 | **Biological Age** | years | Home, Health, Monthly |
| 8 | **Pace of Aging** | ratio (0.5–2.0) | Home (Longevity Sphere), Health, Monthly |
| 9 | **CNS Stress Score** | 0–100 | Health, Weekly |
| 10 | **Immunity Risk** | LOW / ELEVATED / HIGH | Health |
| 11 | **Injury Risk** | LOW / MODERATE / HIGH | Health |
| 12 | **Readiness Score** | 0–100 | Home (Pillar Card) |
| 13 | **Resilience Score** | 0–100 | Home (Pillar Card) |
| 14 | **Longevity Score** | 0–100 | Home (Pillar Card) |
| 15 | **Running Form Risk** | LOW / MODERATE / HIGH | Health |
| 16 | **HRV Z-Score** | standard deviations | Health, Coach |
| 17 | **RHR Z-Score** | standard deviations | Health, Coach |
| 18 | **Target Bedtime** | time (e.g., "8:30 PM") | Home (Daily Directive) |

### Raw Biometrics (shown on Health)

| # | Metric | Unit | Normal Range |
|---|--------|------|-------------|
| 19 | **HRV (rmssd)** | ms | > 20 |
| 20 | **Resting Heart Rate** | bpm | 40–80 |
| 21 | **SpO2** | % | ≥ 95 |
| 22 | **Respiratory Rate** | breaths/min | 8–25 |
| 23 | **Skin Temp Delta** | °C | ±2.0 from baseline |
| 24 | **VO2 Max** | ml/kg/min | varies by age |
| 25 | **Walking Speed** | m/s | — |
| 26 | **Walking Asymmetry** | % | < 3.0 |
| 27 | **Double Support %** | % | ~26–28 |
| 28 | **Stair Speed Up/Down** | m/s | — |
| 29 | **Flights Climbed** | count | — |
| 30 | **Time in Daylight** | minutes | > 30 |
| 31 | **Headphone Audio** | dB | < 70 |
| 32 | **Breathing Disturbances** | events/hr | < 5 |
| 33 | **Physical Effort** | MET-hours | — |

### Sleep Metrics (shown on Sleep Drilldown)

| # | Metric | Unit |
|---|--------|------|
| 34 | **Total Sleep Duration** | minutes / hours |
| 35 | **REM Sleep** | minutes / % |
| 36 | **Deep Sleep** | minutes / % |
| 37 | **Core Sleep** | minutes / % |
| 38 | **Awake Time** | minutes / % |
| 39 | **Sleep Efficiency** | % |

### Running Dynamics (shown on Health)

| # | Metric | Unit |
|---|--------|------|
| 40 | **Running Power** | watts |
| 41 | **Ground Contact Time** | ms |
| 42 | **Vertical Oscillation** | cm |
| 43 | **Stride Length** | m |

### Activity Metrics (shown on Home & Health)

| # | Metric | Unit |
|---|--------|------|
| 44 | **Active Calories** | kcal |
| 45 | **Workout Duration** | minutes |
| 46 | **Heart Rate Zones** | seconds in Z1–Z5 |
| 47 | **Max HR / Avg HR** | bpm |
| 48 | **Steps** | count |

### Correlation Insights (shown on Home)

| # | Metric | Shows |
|---|--------|-------|
| 49 | **Habit Impact %** | How much each habit affects recovery |
| 50 | **Correlation Strength** | Strong / Moderate / Weak / None |
| 51 | **Statistical Significance** | P-value indication |

### Trend Patterns (shown on Health & Weekly)

| # | Pattern | What it detects |
|---|---------|-----------------|
| 52 | `recovery_cliff` | Recovery score dropping sharply |
| 53 | `hrv_surge` | HRV spiking up (positive adaptation) |
| 54 | `rhr_creep` | RHR gradually rising (stress/illness) |
| 55 | `sleep_erosion` | Sleep duration declining |
| 56 | `strain_accumulation` | Training load building up |
| 57 | `cns_fatigue` | CNS stress trending up |
| 58 | `positive_adaptation` | Multiple metrics improving |
| 59 | `inflammation_spike` | Temp + RHR + breathing all elevated |
| 60 | `vo2max_decline` | VO2 Max dropping over weeks |

---

## 🔄 User Flow Summary

```
APP LAUNCH
    │
    ▼
HOME SCREEN
    │
    ├── Swipe date ← → to view history
    ├── See Longevity Sphere (Pace of Aging visual)
    ├── Read Daily Directive (AI command for today)
    ├── Check 3 Pillar scores (Readiness, Resilience, Longevity)
    ├── Tap Pillar Card → HEALTH TAB with focus
    ├── See Activity Timeline
    ├── See Correlation Insights
    ├── See Weekly Planner (7-day forecast)
    ├── Type in AI Prompt Bar → COACH TAB
    ├── Safety Intercept Modal may overlay (critical alerts)
    │
    ├── Tap Health Tab
    │   ├── See Biological Age slider
    │   ├── See Vitals Grid (HRV, RHR, SpO2, RR, Temp)
    │   ├── See Strain progress bar
    │   ├── See Running Dynamics
    │   ├── See Workout History
    │   ├── See Trend Explorer
    │   └── Tap Sleep card → SLEEP DRILLDOWN
    │
    ├── Tap Coach Tab
    │   ├── Tap suggestion chips OR type question
    │   ├── Receive AI coaching response
    │   └── Continue conversation
    │
    ├── Tap Profile Tab
    │   ├── See Personal Records
    │   ├── See Activity Summary by sport
    │   ├── See 7-day Strain vs. Recovery chart
    │   ├── Tap Weekly Summary → WEEKLY DRILLDOWN
    │   ├── Tap Monthly Summary → MONTHLY DRILLDOWN
    │   └── Export data (CSV)
    │
    ├── Sleep Drilldown (pushed from Home/Health)
    │   ├── See Sleep Stage Hypnogram
    │   ├── See Sleep Quality Dashboard
    │   └── See 7-night history
    │
    ├── Weekly Summary
    │   ├── Paginate through weeks
    │   ├── See sparklines, strain bars, correlations
    │   └── Read AI weekly insight
    │
    └── Monthly Summary
        ├── Paginate through months
        ├── See recovery heatmap
        ├── See VO2 Max trend
        └── See biological age progression
```

---

## ⚠️ Intercept Modal States

Critical safety alerts that overlay any screen when triggered. Designer needs to create:

| State | Visual Tone | Icon | Action Button Label |
|-------|-------------|------|---------------------|
| Workout Block | Red, urgent | ⚠️ | "View Mobility Plan" |
| Rest Mandate | Red, serious | 🛌 | "View Recovery Plan" |
| Sleep Prescription | Purple, caring | 🌙 | "View Sleep Schedule" |
| Circadian Warning | Amber, advisory | ☀️ | "View Light Exposure" |
| Trend Degradation | Amber, proactive | ⚡ | "View Trends" |

Each trigger has:
- Severity badge (critical = red, warning = amber, info = blue)
- Icon
- Title (e.g., "WORKOUT BLOCKED")
- Description message
- Action button that navigates to the relevant drilldown

---

## 🎯 Empty States & Loading States

Designer needs to create:

1. **First Launch / No Data**: Home screen shows skeleton loading → then empty state prompting user to sync HealthKit ("We need 14 days of data for accurate insights")
2. **Syncing**: Progress indicator on Home screen during background sync
3. **Date with No Data**: When scrolling to a date that has no records — show "No data for this date" state
4. **Coach Empty State**: Suggestion chips when no chat history exists
5. **Weekly/Monthly Empty**: "Not enough data for this period" state

---

## 📱 Responsive Notes

- Target device: iPhone (all sizes from SE to Pro Max)
- OLED black background leverages notch/dynamic island naturally
- Cards use flexible widths (not fixed pixel values)
- Tab bar: standard bottom tab, 4 items
- Safe area insets respected throughout

---

*Document generated from the Elite Health AI codebase — covers the Expo (React Native) mobile application only.*
