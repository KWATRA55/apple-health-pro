# Elite Health AI — Biometric Tracking & Core Scoring Algorithms Reference

This document provides a comprehensive mathematical, architectural, and logical reference for all biometric features, tracked parameters, and calculated scoring engines implemented in **Elite Health AI** (Next.js Analytics Web Engine & Expo Mobile Application).

---

## 📊 1. Data Model & Tracked Parameters

The system ingests and processes high-resolution health data across several categories. The unified database schema defines the following variables tracked under both Next.js and React Native:

### Biometrics & Vitals (`vitals`)
*   **HRV (Heart Rate Variability)** `[ms]`: Root Mean Square of Successive Differences (RMSSD) reflecting parasympathetic autonomic activity.
*   **RHR (Resting Heart Rate)** `[bpm]`: Lowest sustained heart rate during deep sleep.
*   **SpO2 (Blood Oxygen Saturation)** `[%]`: Peripheral capillary oxygen saturation.
*   **Respiratory Rate** `[breaths/min]`: Mean respiration frequency during sleep window.
*   **Skin Temp Delta** `[°C]`: Wrist temperature deviations from baseline.

### Sleep Architecture (`sleep`)
*   **Total Duration** `[minutes]`: Total time spent in sleep states (REM + Deep + Core).
*   **REM Sleep** `[minutes]`: Rapid Eye Movement phase duration.
*   **Deep Sleep** `[minutes]`: Slow-wave restorative sleep phase duration.
*   **Core Sleep** `[minutes]`: Light sleep phase duration.
*   **Awake Time** `[minutes]`: Active wakefulness periods during the sleeping window.
*   **Sleep Need** `[hours]`: Dynamically calculated sleep hours required (base of 8.0 hours adjusted for daily accumulated debt).
*   **Sleep Debt** `[hours]`: Unmet sleep duration compiled recursively over a rolling 7-day period.

### Physical Activity (`activity`)
*   **Active Calories** `[kcal]`: Energy expenditure beyond basal metabolic rate.
*   **Workout Type** `[string]`: Sport classification (e.g., Running, Cycling, HIIT, Strength).
*   **Duration** `[minutes]`: Time spent in active training sessions.
*   **Heart Rate Zones** `[JSON / Array]`: Duration (seconds) spent in Z1, Z2, Z3, Z4, and Z5.
*   **Max HR & Average HR** `[bpm]`: Peak and mean heart rate during exercise.

### Mobility & Biomechanics (`mobility`)
*   **Daily Steps** `[count]`: Total step count.
*   **Walking Speed** `[m/s]`: Flat-ground walking velocity.
*   **Walking Step Length** `[m]`: Mean distance covered per single step.
*   **Walking Asymmetry** `[%]`: Percentage of gait imbalance between left and right foot strikes.
*   **Double Support %** `[%]`: Percentage of gait cycle where both feet are in contact with the ground.
*   **Stair Speed Up/Down** `[m/s]`: Ascending and descending velocities on stairs.
*   **Flights Climbed** `[count]`: Total elevation gained in floors.

### Cardio-Metabolic Baselines (`cardio_metabolic`)
*   **VO2 Max** `[ml/kg/min]`: Maximum rate of oxygen consumption during incremental exercise.
*   **Walking HR Average** `[bpm]`: Mean heart rate during flat-ground walking.
*   **Resting Energy** `[kcal]`: Basal metabolic rate (BMR) energy expenditure.
*   **Physical Effort** `[MET-hours]`: Metabolic Equivalent of Task hours (intensity × duration).
*   **Breathing Disturbances** `[events/hour]`: Frequency of sleep apnea or respiratory disruptions.

### Environmental Exposures (`environmental`)
*   **Time in Daylight** `[minutes]`: Cumulative exposure to light intensity (>800 lux).
*   **Headphone Audio** `[dB]`: Daily average decibel volume exposure (auditory strain marker).
*   **Stand Minutes / Hours** `[minutes/count]`: Active standing habits to disrupt sedentary behaviors.

### Running Dynamics (`running_dynamics`)
*   **Running Power** `[watts]`: Mechanical work rate computed during running.
*   **Ground Contact Time** `[ms]`: Duration the foot remains on the ground during a stride.
*   **Vertical Oscillation** `[cm]`: Degree of vertical "bounce" in the torso per step.
*   **Stride Length** `[m]`: Distance covered per complete running cycle.

---

## 🧮 2. Mathematical Scoring Engines & Formulas

Every metric computed by the application is built using professional sports science and longevity research formulas. Below are the precise mathematical calculations utilized by the codebase:

### 🟩 A. Recovery Score (Whoop-Style)
*   **File Path**: `[elite-health/src/lib/algorithms/recovery.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/recovery.ts)` & `[src/lib/algorithms/recovery.ts](file:///Users/shashwat/Desktop/apple-health-ai/src/lib/algorithms/recovery.ts)`
*   **Logical Overview**: Combines autonomic vitals (HRV and RHR) scored via statistical deviation (Z-scores) from historical baselines with a sleep quality multiplier.
*   **Formulas**:
    
    1.  **Z-Score Calculations**:
        $$Z_{\text{HRV}} = \frac{\text{HRV}_{\text{today}} - \mu_{\text{HRV}}}{\sigma_{\text{HRV}}}$$
        $$Z_{\text{RHR}} = \frac{\text{RHR}_{\text{today}} - \mu_{\text{RHR}}}{\sigma_{\text{RHR}}}$$
        *(Where $\mu$ is the historical population mean, and $\sigma$ is the historical standard deviation).*

    2.  **Normalized Biometrics**:
        $$\text{Norm}_{\text{HRV}} = \text{clamp}\left(\frac{Z_{\text{HRV}} + 2}{4}, 0, 1\right)$$
        $$\text{Norm}_{\text{RHR}} = \text{clamp}\left(\frac{-Z_{\text{RHR}} + 2}{4}, 0, 1\right)$$
        *(Resting HR is inversely related to recovery, hence $-Z_{\text{RHR}}$).*

    3.  **Sleep Quality Factor (Sigmoid Function)**:
        $$\text{Ratio}_{\text{sleep}} = \min\left(\frac{\text{Hours}_{\text{actual}}}{\text{Hours}_{\text{need}}}, 2\right)$$
        $$\text{Sleep Quality Factor} = \frac{1}{1 + e^{-4 \cdot (\text{Ratio}_{\text{sleep}} - 0.85)}}$$
        *(This creates an S-curve: sleep below 85% of need severely penalizes recovery, while sleep above it reaches a flat plateau).*

    4.  **Composite Recovery Score**:
        $$\text{Raw Recovery} = (\text{Norm}_{\text{HRV}} \cdot 0.5 + \text{Norm}_{\text{RHR}} \cdot 0.3 + \text{Sleep Quality Factor} \cdot 0.2) \cdot 100$$
        $$\text{Recovery Score} = \text{clamp}(\text{round}(\text{Raw Recovery}), 0, 100)$$

*   **Recovery Zones**:
    *   🔴 **Red (Critical Strain/Fatigue)**: $0 \le \text{Score} \le 33$
    *   🟡 **Yellow (Accumulated Load)**: $34 \le \text{Score} \le 66$
    *   🟢 **Green (Fully Restored)**: $67 \le \text{Score} \le 100$

---

### 🟥 B. Strain Score (Whoop-Style)
*   **File Path**: `[elite-health/src/lib/algorithms/strain.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/strain.ts)` & `[src/lib/algorithms/strain.ts](file:///Users/shashwat/Desktop/apple-health-ai/src/lib/algorithms/strain.ts)`
*   **Logical Overview**: Quantifies cardiovascular exertion. It utilizes a logarithmic scale that compresses extremely heavy training blocks so that a score of 21 represents physiological absolute maximum effort.
*   **Formulas**:
    
    1.  **Max HR Formula**:
        $$\text{Max HR} = 220 - \text{Age}$$
    
    2.  **Heart Rate Zones**:
        *   **Zone 1 (Recovery)**: $50\% - 60\%$ of Max HR (Weight = $1$)
        *   **Zone 2 (Endurance)**: $60\% - 70\%$ of Max HR (Weight = $2$)
        *   **Zone 3 (Tempo)**: $70\% - 80\%$ of Max HR (Weight = $4$)
        *   **Zone 4 (Threshold)**: $80\% - 90\%$ of Max HR (Weight = $8$)
        *   **Zone 5 (VO2 Max)**: $90\% - 100\%$ of Max HR (Weight = $16$)

    3.  **Logarithmic Strain Equation**:
        $$\text{Weighted Sum} = \sum_{i=1}^{5} (\text{Zone Duration in seconds})_i \cdot \text{Weight}_i$$
        $$\text{Strain Score} = \text{clamp}\left(\text{round}\left(\ln(1 + \text{Weighted Sum}) \cdot 2.5 \cdot 10\right) / 10, 0, 21.0\right)$$

*   **Strain Classifications**:
    *   🟢 **Light Exertion**: $\text{Score} < 5.0$
    *   🟡 **Moderate Exertion**: $5.0 \le \text{Score} < 10.0$
    *   🟠 **High Exertion**: $10.0 \le \text{Score} < 14.0$
    *   🔴 **Very High Exertion**: $14.0 \le \text{Score} < 18.0$
    *   🔥 **Maximal Exertion**: $18.0 \le \text{Score} \le 21.0$

---

### 🌙 C. Sleep Need and Sleep Debt
*   **File Path**: `[elite-health/src/lib/algorithms/sleep-debt.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/sleep-debt.ts)` & `[src/lib/algorithms/sleep-debt.ts](file:///Users/shashwat/Desktop/apple-health-ai/src/lib/algorithms/sleep-debt.ts)`
*   **Logical Overview**: Implements a rolling 7-day sleep debt accumulation model. As sleep debt grows, the daily target sleep need is dynamically increased to pay back the physiological debt.
*   **Formulas**:
    
    1.  **Baseline Sleep Need**:
        $$\text{Baseline Need} = 8.0 \text{ hours}$$

    2.  **Cumulative Sleep Debt**:
        $$\text{Sleep Debt} = \sum_{d=1}^{7} \max\left(0, \text{Sleep Need}_d - \text{Sleep Duration}_d\right)$$

    3.  **Adjusted Sleep Need**:
        $$\text{Average Daily Debt} = \frac{\text{Sleep Debt}}{\text{Days Recorded (up to 7)}}$$
        $$\text{Adjusted Sleep Need} = \text{Baseline Need} + (\text{Average Daily Debt} \cdot 0.5)$$

---

### 📈 D. Sleep Quality & Performance Score
*   **File Path**: `[elite-health/src/lib/algorithms/sleep-performance.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/sleep-performance.ts)`
*   **Logical Overview**: Analyzes sleep phases (combining REM and Deep ratios with duration) and applies compounding penalties for sleep debt and excessive awake periods.
*   **Formulas**:
    
    1.  **Sleep Phase Ratios**:
        $$\text{Sleep Time} = \text{REM Mins} + \text{Deep Mins} + \text{Core Mins}$$
        $$\text{Ratio}_{\text{REM}} = \frac{\text{REM Mins}}{\text{Sleep Time}}$$
        $$\text{Ratio}_{\text{Deep}} = \frac{\text{Deep Mins}}{\text{Sleep Time}}$$

    2.  **Phase Sub-Scores** *(comparing deviations against medical ideals)*:
        *   **Ideal REM ratio**: $22\%$ ($0.22$)
        *   **Ideal Deep ratio**: $17\%$ ($0.17$)
        $$\text{Score}_{\text{REM}} = 1 - \min\left(1, \frac{|\text{Ratio}_{\text{REM}} - 0.22|}{0.22}\right)$$
        $$\text{Score}_{\text{Deep}} = 1 - \min\left(1, \frac{|\text{Ratio}_{\text{Deep}} - 0.17|}{0.17}\right)$$
        $$\text{Score}_{\text{Duration}} = \min\left(1, \frac{\text{Hours}_{\text{actual}}}{\text{Hours}_{\text{need}}}\right)$$

    3.  **Weighted Base Sleep Quality**:
        $$\text{Base Quality} = (\text{Score}_{\text{REM}} \cdot 0.35 + \text{Score}_{\text{Deep}} \cdot 0.35 + \text{Score}_{\text{Duration}} \cdot 0.3) \cdot 100$$

    4.  **Penalties Applied**:
        *   *Sleep Debt penalty*:
            *   If $\text{Sleep Debt} > 2.0\text{ hrs} \implies \text{Base Quality} \leftarrow \text{Base Quality} \cdot 0.85$
            *   Else if $\text{Sleep Debt} > 1.0\text{ hr} \implies \text{Base Quality} \leftarrow \text{Base Quality} \cdot 0.92$
        *   *Awake Ratio penalty*:
            *   If $\frac{\text{Awake Mins}}{\text{Total Sleep Duration}} > 10\% \implies \text{Base Quality} \leftarrow \text{Base Quality} \cdot 0.90$

---

### ⏳ E. Biological Age & Pace of Aging (Longevity Engine)
*   **File Path**: `[elite-health/src/lib/algorithms/biological-age.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/biological-age.ts)`
*   **Logical Overview**: Translates biometric markers (HRV, RHR, SpO2) into cellular health age, evaluating them against average metrics of a healthy 25-year-old vs. 40-year-old.
*   **Formulas**:
    
    1.  **Biometric Baseline Constants**:
        *   **Age 25 Healthy Averages**: $\text{HRV} = 65\text{ms}$, $\text{RHR} = 62\text{bpm}$, $\text{SpO2} = 98\%$
        *   **Age 40 Healthy Averages**: $\text{HRV} = 55\text{ms}$, $\text{RHR} = 66\text{bpm}$, $\text{SpO2} = 97\%$

    2.  **Biometric Sub-Scores**:
        $$\text{Sub}_{\text{HRV}} = \frac{\text{HRV}_{\text{today}} - 65}{55 - 65} = \frac{65 - \text{HRV}_{\text{today}}}{10}$$
        $$\text{Sub}_{\text{RHR}} = \frac{\text{RHR}_{\text{today}} - 62}{66 - 62} = \frac{\text{RHR}_{\text{today}} - 62}{4}$$
        $$\text{Sub}_{\text{SpO2}} = \frac{\text{SpO2}_{\text{today}} - 98}{97 - 98} = 98 - \text{SpO2}_{\text{today}}$$

    3.  **Composite Age Delta Score**:
        $$\text{Composite} = \frac{\text{Sub}_{\text{HRV}} \cdot (-0.4) + \text{Sub}_{\text{RHR}} \cdot 0.35 + \text{Sub}_{\text{SpO2}} \cdot (-0.15)}{0.9}$$
        $$\text{Biological Age} = \text{clamp}(25 + \text{Composite} \cdot 15, 18, 80)$$

    4.  **Pace of Aging**:
        $$\text{Pace of Aging} = \text{clamp}\left(1.0 + \frac{\text{Biological Age} - \text{Age}_{\text{chronological}}}{\max(1, \text{Age}_{\text{chronological}} - 18)}, 0.5, 2.0\right)$$
        *(Pace of Aging < 1.0 indicates physiological deceleration of aging).*

---

### 🧠 F. Central Nervous System (CNS) Stress Score
*   **File Path**: `[elite-health/src/lib/algorithms/cns-stress.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/cns-stress.ts)`
*   **Logical Overview**: Evaluates autonomic stress and daily environmental overload (audio strain and lack of natural light exposure) combined with sleep and autonomic metrics.
*   **Formulas**:
    
    1.  **Component Calculations**:
        $$\text{HRV Suppression \%} = \frac{\text{HRV}_{\text{baseline}} - \text{HRV}_{\text{today}}}{\text{HRV}_{\text{baseline}}} \cdot 100$$
        $$\text{Sleep Deficit \%} = \frac{\text{Sleep Need} - \text{Sleep Duration}}{\text{Sleep Need}} \cdot 100$$

    2.  **Point Compilation System** *(Base Score starts at 20)*:
        *   *Headphone Audio dB*:
            *   If $\text{Audio} > 80\text{dB} \implies +25$ points
            *   Else if $\text{Audio} > 70\text{dB} \implies +10$ points
        *   *Time in Daylight*:
            *   If $\text{Daylight} < 20\text{ mins} \implies +20$ points
            *   Else if $\text{Daylight} < 40\text{ mins} \implies +10$ points
        *   *HRV Suppression*:
            *   If $\text{HRV Suppression \%} \ge 10\% \implies +25$ points
            *   Else if $\text{HRV Suppression \%} > 0\% \implies +\min(15, \text{HRV Suppression \%})$
        *   *Sleep Deficit*:
            *   If $\text{Sleep Deficit \%} \ge 20\% \implies +20$ points
            *   Else if $\text{Sleep Deficit \%} > 0\% \implies +\min(15, \text{Sleep Deficit \%})$
        
        $$\text{CNS Stress Score} = \text{clamp}(\text{Score}, 0, 100)$$

    3.  **CNS Stress Risk Boundaries**:
        *   🔴 **HIGH Risk**: Triggered if $\text{Audio} > 80\text{dB} \land \text{Daylight} < 20\text{m} \land \text{HRV Suppression} \ge 10\%$ **OR** if $\text{CNS Stress Score} > 65$
        *   🟡 **MODERATE Risk**: $40 < \text{CNS Stress Score} \le 65$
        *   🟢 **LOW Risk**: $\text{CNS Stress Score} \le 40$

---

### 🛡️ G. Illness/Immunity Risk Predictor
*   **File Path**: `[elite-health/src/lib/algorithms/illness-predictor.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/illness-predictor.ts)`
*   **Logical Overview**: Analyzes nocturnal biological changes indicating that the immune system is actively fighting pathogens, assessing 5 core biometric warning triggers.
*   **Warning Signals**:
    *   `tempSpike` : $\text{Skin Temp Delta} \ge 0.5^\circ\text{C}$
    *   `breathingSpike` : $\text{Breathing Disturbances} \ge 8.0\text{ events/hour}$
    *   `rhrSpike` : $\text{RHR}_{\text{today}} \ge \text{RHR}_{\text{baseline}} + 4\text{ bpm}$
    *   `spo2Decline` : $\text{SpO2} > 0 \land \text{SpO2} < 95\%$
    *   `hrvSuppressed` : $\text{HRV}_{\text{today}} > 0 \land \text{HRV}_{\text{today}} < \text{HRV}_{\text{baseline}} \cdot 0.85$

*   **Risk Outcome Rules**:
    *   🔴 **HIGH RISK** (Confidence = 92%): If `tempSpike && breathingSpike && rhrSpike` are all active.
    *   🟡 **ELEVATED RISK** (Confidence = 70%): If $\ge 2$ signals are active.
    *   🟡 **ELEVATED RISK** (Confidence = 50%): If exactly $1$ signal is active.
    *   🟢 **LOW RISK** (Confidence = 95%): If $0$ signals are active.

---

### 🦿 H. Biomechanical Injury Risk Predictor
*   **File Path**: `[elite-health/src/lib/algorithms/injury-predictor.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/injury-predictor.ts)`
*   **Logical Overview**: Analyzes gait metrics, stairs speeds, and running dynamics ground contact time (GCT) to predict lower-limb kinetic chain injury risks.
*   **Formulas & Triggers**:
    *   `asymmetryDelta` = $\text{Walking Asymmetry}_{\text{today}} - \text{Asymmetry}_{\text{baseline}}$
    *   `doubleSupportDelta` = $\text{Double Support}_{\text{today}} - \text{Double Support}_{\text{baseline}}$
    *   `stairDownDeclinePercent` = $\frac{\text{Stair Speed Down}_{\text{baseline}} - \text{Stair Speed Down}_{\text{today}}}{\text{Stair Speed Down}_{\text{baseline}}} \cdot 100$
    *   `gctElevation` = $\text{GCT}_{\text{today}} - \text{GCT}_{\text{baseline}}$
    
    *   *Warning Flags*:
        *   `highAsymmetry`: $\text{Walking Asymmetry} > 5.0\%$
        *   `doubleSupportSpike`: $\text{doubleSupportDelta} \ge 2.0\%$
        *   `stairSpeedDrop`: $\text{stairDownDeclinePercent} \ge 10.0\%$
        *   `gctSpike`: $\text{gctElevation} > 15\text{ms}$

*   **Injury Risk Outcome Rules**:
    *   🔴 **HIGH RISK** (Confidence = 88%): If `highAsymmetry` is active AND (`doubleSupportSpike` OR `stairSpeedDrop` is active).
    *   🟡 **MODERATE RISK** (Confidence = 65%): If $\text{Walking Asymmetry} > 3.0\%$ OR $\text{doubleSupportDelta} > 1.5\%$ OR `stairSpeedDrop` OR `gctSpike` is active.
    *   🟢 **LOW RISK** (Confidence = 95%): Biomechanical markers are balanced.

---

### 🏃‍♂️ I. Running Form Degradation
*   **File Path**: `[elite-health/src/lib/algorithms/running-form.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/running-form.ts)`
*   **Logical Overview**: Evaluates active running mechanics week-over-week. It detects asymmetrical fatigue or stride decay that leads to musculoskeletal strain.
*   **Formulas**:
    $$\text{gctChange} = \frac{\text{Ground Contact Time}_{\text{recent}} - \mu_{\text{GCT}}}{\mu_{\text{GCT}}}$$
    $$\text{oscChange} = \frac{\text{Vertical Oscillation}_{\text{recent}} - \mu_{\text{Vertical Oscillation}}}{\mu_{\text{Vertical Oscillation}}}$$
    *(Where $\mu$ represents the rolling 7-14 day average baseline).*

*   **Breakdown Alarms**:
    *   🔴 **HIGH Risk (Form Decay)**: Triggered if $\text{gctChange} > 0.10$ (Ground Contact Time increased by over 10%).
    *   🟡 **MODERATE Risk (Stride Inefficiency)**: Triggered if $\text{oscChange} > 0.15$ (Vertical bounce increased by over 15% due to core fatigue).
    *   🟢 **LOW Risk (Stable Dynamics)**: Stride patterns remain stable.

---

### 🔬 J. Habit Impact & Pearson Correlation Engine
*   **File Path**: `[elite-health/src/lib/algorithms/pearson-correlation.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/pearson-correlation.ts)` & `[elite-health/src/lib/algorithms/habit-impact.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/habit-impact.ts)`
*   **Logical Overview**: Quantifies lifestyle choices (logged habits like alcohol, caffeine, meditation) against physiological recovery. It uses Pearson correlation coefficient $r$, coefficient of determination $R^2$, and approximate two-tailed $P$-values to filter statistical noise from genuine physiological impacts.
*   **Formulas**:
    
    1.  **Binary Habit vs. Continuous Score Mapping**:
        *   Pairs arrays where $x_i \in \{0, 1\}$ (habit logged/not logged) and $y_i \in [0, 100]$ (Recovery Score).
    
    2.  **Pearson Correlation Coefficient ($r$)**:
        $$r = \frac{\sum (x_i - \bar{x})(y_i - \bar{y})}{\sqrt{\sum (x_i - \bar{x})^2 \sum (y_i - \bar{y})^2}}$$
        $$R^2 = r \cdot r$$
        *(We clamp $r$ strictly between $-1.0$ and $1.0$).*

    3.  **Statistical Significance ($P$-Value)**:
        *   Computes $t$-statistic:
            $$t = r \cdot \sqrt{\frac{n - 2}{1 - r^2}}$$
        *   Approximates the two-tailed $P$-value using a polynomial CDF approximation of the normal distribution:
            $$P = 2 \cdot (1 - \Phi(|t|))$$
            *(A $P$-value $< 0.05$ is flagged as statistically significant).*

    4.  **Habit Significance Classifications**:
        *   **Strong Correlation**: $|r| \ge 0.7$
        *   **Moderate Correlation**: $0.4 \le |r| < 0.7$
        *   **Weak Correlation**: $0.2 \le |r| < 0.4$
        *   **No Correlation**: $|r| < 0.2$

    5.  **Average Impact Percentage**:
        $$\text{Impact} = \frac{\text{Average Recovery with Habit} - \text{Overall Average Recovery}}{\text{Overall Average Recovery}} \cdot 100$$

---

### ⚡ K. Heuristic Synthesis (The Daily Directive Engine)
*   **File Path**: `[elite-health/src/lib/algorithms/heuristic-synthesis.ts](file:///Users/shashwat/Desktop/apple-health-ai/elite-health/src/lib/algorithms/heuristic-synthesis.ts)`
*   **Logical Overview**: The core coordinator of the Elite Health AI engine. It synthesizes biometrics, algorithms, risks, and environments into three health pillars, generating dynamic user recommendations (Daily Directives) and emergency workout intercepts.

#### 1. Pillar Scores
*   **Readiness Pillar (Autonomic Reserve & Vitals)**:
    $$\text{hrvScore} = \text{clamp}\left(\frac{\text{HRV}_{\text{today}}}{\text{HRV}_{\text{baseline}}} \cdot 50, 0, 50\right)$$
    $$\text{rhrScore} = \text{clamp}\left(\left(2 - \frac{\text{RHR}_{\text{today}}}{\text{RHR}_{\text{baseline}}}\right) \cdot 25, 0, 25\right)$$
    $$\text{sleepScore} = \min\left(1, \frac{\text{Sleep Duration}}{\text{Sleep Need}}\right) \cdot 25$$
    $$\text{Readiness Score} = \text{hrvScore} + \text{rhrScore} + \text{sleepScore}$$
    *   *Zones*: $\ge 75 \implies$ **PRIMED** (teal), $\le 40 \implies$ **DEPLETED** (red), else **MODERATE** (amber).

*   **Resilience Pillar (Defensive Integrity)**:
    *   Starts at a base of 85.
    *   *System Deductions*:
        *   Immune Risk: High $\implies -30$; Elevated $\implies -15$
        *   Injury Risk: High $\implies -25$; Moderate $\implies -12$
        *   CNS Stress: High $\implies -20$; Moderate $\implies -8$
        *   Biometric Anomaly: $|\text{Skin Temp Delta}| > 0.5^\circ\text{C} \implies -8$; Breathing Disturbances $> 8.0 \implies -8$; $\text{SpO2} < 95\% \implies -10$
    *   *Zones*: $\ge 75 \implies$ **ROBUST** (purple), $\le 35 \implies$ **FRAGILE** (red), else **GUARDED** (amber).

*   **Longevity Pillar (Senescence Trajectory)**:
    *   Starts at a base of 50.
    *   *Pace of Aging Adjustment*:
        *   $\text{Pace of Aging} \le 1.0 \implies +40$
        *   $\text{Pace of Aging} < 1.1 \implies +20$
        *   $\text{Pace of Aging} < 1.2 \implies +5$
        *   Otherwise $\implies -15$
    *   *VO2 Max adjustment*:
        $$\text{Ideal VO2Max} = 45 - (\text{Age} - 25) \cdot 0.3$$
        $$\text{VO2 Max adjustment} = \left(\frac{\text{VO2 Max}_{\text{actual}}}{\text{Ideal VO2Max}} - 1\right) \cdot 20$$
    *   *Gait Double Support adjustment*:
        $$\text{Ideal DS} = 26 + (\text{Age} - 25) \cdot 0.1$$
        $$\text{If } \text{Double Support}_{\text{actual}} > \text{Ideal DS} \implies \text{DS adjustment} = -(\text{Double Support}_{\text{actual}} - \text{Ideal DS}) \cdot 4$$
    *   *Zones*: $\ge 75 \implies$ **REJUVENATING** (cyan), $\le 35 \implies$ **ACCELERATING** (red), else **NEUTRAL** (amber).

#### 2. Adaptive Targets
*   **Target Strain Formula**:
    *   Prevents overtraining by scaling active limits to your lowest pillar reserve.
    $$\text{Multiplier} = \min\left(\frac{\text{Readiness Score}}{100}, \frac{\text{Resilience Score}}{100}\right)$$
    $$\text{Target Strain} = \text{clamp}(\text{round}(21.0 \cdot \text{Multiplier} \cdot 10) / 10, 2.0, 21.0)$$

*   **Target Bedtime Recommendation**:
    *   *Extreme Sleep Debt ($>2.0$ hours) or High CNS Stress* $\implies$ **8:30 PM / 9:00 PM**
    *   *Moderate Sleep Debt ($>1.0$ hour) or Moderate CNS Stress* $\implies$ **9:30 PM**
    *   *Nominal Conditions* $\implies$ **10:30 PM**

#### 3. Intercept Triggers (Safety Interventions)
The system injects modal warning blocks in the UI under critical circumstances:
1.  **Workout Block (`workout_block`)**: Triggered when biomechanical injury risk is **HIGH**. Restricts impact workouts (running, HIIT) in favor of targeted mobility.
2.  **Rest Mandate (`rest_mandate`)**: Triggered when CNS stress is **HIGH** or Readiness is **DEPLETED** ($\le 40$). Mandates resting state.
3.  **Sleep Prescription (`sleep_prescription`)**: Triggered when Readiness or Resilience drops into the **CRITICAL** zone. Prescribes deep recovery sleep timings.
4.  **Circadian Warning (`hydration_alert`)**: Triggered when average daily headphone decibels exceed 75dB AND total daylight exposure is under 30 minutes. Alerts about sleep suppression hazards.
