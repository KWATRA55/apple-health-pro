import { chunkText } from './chunker'
import { generateEmbedding } from './embeddings'
import { addDocument, deleteAllDocuments, getDocumentCount } from './vector-store'

export interface KnowledgeDoc {
    title: string
    source: string
    content: string
}

export const CURATED_KNOWLEDGE: KnowledgeDoc[] = [
    {
        title: 'Heart Rate Variability Guide',
        source: 'WHOOP & Elite Performance Research',
        content: `
Heart Rate Variability (HRV) is the variation in time between successive heartbeats. Higher HRV generally indicates better recovery and autonomic nervous system balance.

Key HRV Ranges for Athletes:
- Excellent: Above 80ms (exceptional recovery)
- Good: 50-80ms (well recovered)
- Adequate: 30-50ms (moderate recovery, proceed with normal training)
- Low: 20-30ms (fatigued, reduce volume by 30-50%)
- Critical: Below 20ms (CNS fatigue, active recovery only)

HRV responds to training stress, sleep quality, nutrition, hydration, alcohol, and illness. A sudden drop of more than 20% from baseline is a warning sign for overtraining or impending illness.

Recovery protocols for low HRV:
1. 10 minutes of box breathing (4s inhale, 4s hold, 4s exhale, 4s hold)
2. Cold exposure (2-3 minutes at 10-15°C) to stimulate vagal tone
3. Gentle Zone 1 movement (walking, cycling at <60% max HR)
4. Magnesium supplementation (300-400mg before bed)
5. Avoid alcohol, late meals, and screen time 90 minutes before bed
    `.trim(),
    },
    {
        title: 'Sleep Architecture & Recovery',
        source: 'Matthew Walker & Sleep Science Research',
        content: `
Sleep is the most powerful recovery tool available. Sleep architecture consists of cycles lasting approximately 90 minutes, alternating between NREM (deep) and REM sleep.

Optimal Sleep Targets by Training Load:
- Light training day: 7-8 hours
- Moderate training day: 8-9 hours
- Heavy training day (2+ sessions): 9-10 hours
- Competition/race day: 9-10 hours the night before

Deep Sleep (NREM Stage 3):
- Should comprise 15-25% of total sleep time
- Critical for physical recovery, tissue repair, and growth hormone release
- Enhanced by: consistent bedtime, cool room (18-20°C), magnesium, avoiding alcohol

REM Sleep:
- Should comprise 20-25% of total sleep time
- Critical for cognitive recovery, skill consolidation, emotional regulation
- Enhanced by: regular sleep schedule, avoiding caffeine after 2pm

Sleep Debt:
- Accumulated when actual sleep falls below sleep need
- Each hour of sleep debt reduces recovery capacity by approximately 10%
- Chronic sleep debt (>5 hours cumulative) increases injury risk by 60%
- Sleep debt can be recovered over 2-3 nights of extended sleep, not a single night

Circadian Optimization:
- Morning sunlight exposure (10-30 minutes within 30 minutes of waking) sets the circadian clock
- Evening light should be dim and warm-toned
- Temperature minimum occurs around 4-5am; consistent wake time is more important than consistent bedtime
    `.trim(),
    },
    {
        title: 'Training Strain & Load Management',
        source: 'TrainingPeaks, Morpheus, & Sports Science',
        content: `
Training strain represents the cumulative physiological load from all activities. It should be balanced against recovery status.

Strain Score Interpretation (0-21 scale):
- 0-5: Minimal strain (active recovery or rest day)
- 6-10: Light strain (Zone 1-2 work, technique sessions)
- 11-15: Moderate strain (quality session, mixed zones)
- 16-18: High strain (hard interval session, long endurance work)
- 19-21: Maximum strain (race effort, competition, extreme load)

Training Principles:
1. Progressive Overload: Increase volume by no more than 10% week over week
2. Polarized Training: 80% of sessions at low intensity (Zone 1-2), 20% at high intensity (Zone 4-5)
3. Recovery Weeks: Every 3-4 weeks, reduce volume by 30-50% for a deload week
4. Acute:Chronic Workload Ratio (ACWR) should stay between 0.8 and 1.3 for injury prevention

Heart Rate Zone Training:
- Zone 1 (50-60% max HR): Recovery, warm-up, cool-down
- Zone 2 (60-70% max HR): Base endurance, fat oxidation, mitochondrial development
- Zone 3 (70-80% max HR): Tempo, lactate threshold development
- Zone 4 (80-90% max HR): VO2max development, intervals of 3-8 minutes
- Zone 5 (90-100% max HR): Anaerobic capacity, sprints, intervals of 30-90 seconds

Overtraining Warning Signs:
1. HRV drops >20% from baseline for 3+ consecutive days
2. Resting heart rate increases >5 bpm from baseline
3. Sleep quality declines (less deep sleep, more awakenings)
4. Mood disturbances, irritability, loss of motivation
5. Persistent muscle soreness beyond 72 hours post-session
6. Increased susceptibility to minor illnesses
    `.trim(),
    },
    {
        title: 'Nutrition for Recovery & Performance',
        source: 'Precision Nutrition & Sports Dietetics',
        content: `
Nutrition is the foundation of recovery. What and when you eat directly impacts training adaptation and recovery capacity.

Macronutrient Guidelines for Athletes:
- Protein: 1.6-2.2g per kg of bodyweight daily, distributed across 4-5 feedings
- Carbohydrates: 3-7g per kg daily depending on training volume (higher on heavy days)
- Fat: 20-35% of total calories, emphasis on omega-3s and monounsaturated fats

Post-Workout Window (within 30-60 minutes):
- 20-40g protein + 40-80g carbohydrates (3:1 or 4:1 carb-to-protein ratio)
- Whey protein isolate is fastest-absorbing
- Add 500-1000mg sodium if heavy sweating occurred

Hydration:
- Minimum: 35ml per kg bodyweight daily
- During training: 500-750ml per hour, with electrolytes if session exceeds 90 minutes
- Post-training: replace 150% of fluid lost (weigh before and after)

Key Recovery Nutrients:
- Omega-3 fatty acids (2-3g EPA/DHA daily): reduce inflammation, support joint health
- Vitamin D (2000-4000 IU daily): immune function, bone health, muscle recovery
- Magnesium (300-400mg): sleep quality, muscle relaxation, HRV support
- Zinc (15-30mg): immune function, protein synthesis
- Tart cherry juice: reduces DOMS and improves sleep quality

Nutrition Timing for Sleep:
- Last large meal 3 hours before bed
- Light protein snack (casein) before bed supports overnight muscle repair
- Avoid caffeine within 8 hours of bedtime (half-life is 5-6 hours)
- Avoid alcohol: even one drink reduces REM sleep by 15-20%
    `.trim(),
    },
    {
        title: 'Respiratory Rate & Health Monitoring',
        source: 'Oura Ring & Clinical Research',
        content: `
Respiratory rate (breaths per minute) is an underutilized but powerful biomarker. Unlike HRV, it does not require complex interpretation to detect anomalies.

Normal Respiratory Rate Ranges:
- Optimal: 12-16 breaths per minute at rest
- Acceptable: 16-18 bpm (slightly elevated, monitor)
- Elevated: 18-22 bpm (physiological stress, consider reduced training)
- High: Above 22 bpm (likely illness, overtraining, or respiratory stress)

Respiratory rate typically increases 1-2 days before symptom onset of illness, making it an early warning signal. A sustained increase of more than 3 bpm from baseline for 2+ consecutive days warrants investigation.

Factors that elevate respiratory rate:
- Overtraining and insufficient recovery
- Oncoming illness (often precedes fever by 24-48 hours)
- Alcohol consumption (dose-dependent increase)
- High altitude exposure
- Stress and anxiety
- Late meals (metabolic demand during digestion)

Respiratory rate should be measured during sleep or quiet rest for consistency. The combination of elevated respiratory rate (>18) AND decreased HRV (>20% drop) is a strong signal to take a rest day.
    `.trim(),
    },
    {
        title: 'Skin Temperature & Inflammation',
        source: 'Oura Ring, WHOOP & Thermoregulation Research',
        content: `
Skin temperature deviation from baseline is a valuable recovery and health biomarker. A deviation of more than ±0.5°C from personal baseline is significant.

Temperature Deviation Interpretation:
- 0 to +0.5°C: Normal circadian variation
- +0.5 to +1.5°C: Elevated metabolic activity (intense training response, alcohol, late meal)
- Above +1.5°C: Likely immune response or illness onset
- Below -0.5°C: Possible thyroid downregulation, caloric deficit, or overtraining

Nighttime skin temperature should naturally drop 1-2°C from daytime levels to facilitate deep sleep. A cool sleeping environment (18-20°C / 65-68°F) supports this thermoregulatory drop.

Inflammation and Temperature:
- Systemic inflammation from heavy training can elevate skin temperature by 0.3-1.0°C for 24-48 hours
- If elevated temperature persists beyond 48 hours post-heavy session, recovery is incomplete
- Pair temperature data with resting heart rate and HRV for a complete picture of inflammatory status

Cold exposure protocols:
- 2-3 minutes at 10-15°C post-training reduces inflammation markers
- Not recommended immediately after strength training (blunts hypertrophy signaling)
- Best timing: morning or 2+ hours post-endurance session
    `.trim(),
    },
    {
        title: 'Blood Oxygen (SpO2) & Cardiorespiratory Health',
        source: 'Clinical & Altitude Research',
        content: `
Peripheral oxygen saturation (SpO2) measures the percentage of hemoglobin carrying oxygen. Normal values are 95-100% at sea level.

SpO2 Ranges:
- 95-100%: Normal at sea level
- 90-94%: Mild hypoxemia (monitor, may indicate respiratory issue)
- 85-89%: Moderate hypoxemia (concerning, warrants rest and monitoring)
- Below 85%: Severe hypoxemia (medical attention needed)

Training Implications:
- SpO2 naturally drops during intense exercise but should recover to >95% within 10 minutes
- Consistently low SpO2 (<95%) at rest indicates incomplete recovery or respiratory stress
- Altitude training: SpO2 of 85-92% at moderate altitude (2000-3000m) is expected and drives adaptation

Sleep and SpO2:
- SpO2 should remain >92% during sleep
- Dips below 90% during sleep (sleep apnea indicator) require investigation
- Alcohol before bed increases frequency and severity of oxygen desaturations

VO2max and SpO2 relationship:
- Higher VO2max correlates with faster SpO2 recovery after exercise
- A declining trend in resting SpO2 alongside declining VO2max suggests detraining or overtraining
    `.trim(),
    },
    {
        title: 'Mobility, Walking & Injury Prevention',
        source: 'Functional Movement & Biomechanics Research',
        content: `
Mobility and gait metrics provide early warning of injury risk and recovery quality.

Walking Asymmetry:
- Normal: 0-2% asymmetry between left and right sides
- Caution: 2-4% asymmetry (monitor, add mobility work)
- High risk: >4% asymmetry (reduce training load, focus on corrective exercises)
- Asymmetry typically increases with fatigue and accumulated training load

Double Support Time:
- Represents the percentage of gait cycle where both feet are on the ground
- Normal: 20-30% of gait cycle in healthy adults
- Higher values (>30%) indicate increased stability demand (fatigue, injury compensation)
- Lower values (<18%) in athletes indicate efficient, powerful gait

Walking Speed:
- Excellent performance indicator and longevity predictor
- <1.0 m/s: Below average, increased fall risk
- 1.0-1.3 m/s: Average
- 1.3-1.5 m/s: Above average
- >1.5 m/s: Excellent functional capacity

Stair Speed (up):
- >0.8 m/s: Excellent leg power
- 0.5-0.8 m/s: Adequate
- <0.5 m/s: Needs improvement, strength training indicated

Injury Risk Reduction:
- Mobility work (dynamic stretching, foam rolling) 10-15 minutes daily
- Single-leg stability exercises 3x weekly
- Hip and ankle mobility: critical for running economy and injury prevention
- Strength training 2-3x weekly reduces injury risk by 50-70% in endurance athletes
    `.trim(),
    },
    {
        title: 'CNS Fatigue & Autonomic Recovery',
        source: 'Morpheus, Elite HRV & Neuroscience Research',
        content: `
Central Nervous System (CNS) fatigue is distinct from muscular fatigue. It involves decreased neural drive and impaired coordination, reaction time, and decision-making.

CNS Fatigue Indicators:
1. HRV drops >20% from baseline (parasympathetic withdrawal)
2. Resting heart rate increases >5 bpm
3. Heart rate response to submaximal exercise is blunted (can't reach normal HR)
4. Reaction time slows (simple reaction test >300ms is concerning)
5. Sleep architecture degrades (less REM, more awakenings)
6. Mood disturbances: irritability, apathy, decreased motivation
7. Perceived exertion is elevated for the same workload

CNS Recovery Protocols:
1. Complete rest: no structured training for 24-48 hours
2. Gentle walking only (Zone 1, <60% max HR, <30 minutes)
3. Cold water immersion (10-15°C, 5-10 minutes) to reduce CNS inflammation
4. Meditation/breathwork: 20 minutes of guided breathwork reduces sympathetic tone
5. Sleep extension: aim for 9-10 hours
6. Avoid: caffeine after 12pm, alcohol, screens 90 minutes before bed
7. Nutrition: increase carbohydrate intake, ensure adequate calories

CNS recovery takes 48-72 hours for mild fatigue and 5-7 days for severe fatigue. Training should not resume until HRV returns to within 10% of baseline and resting heart rate normalizes.

Differentiating CNS fatigue from physical fatigue:
- CNS: you feel "wired but tired," mental fog, poor coordination
- Physical: muscle soreness, heavy legs, but mental clarity remains
    `.trim(),
    },
    {
        title: 'VO2max Development & Cardiorespiratory Fitness',
        source: 'Exercise Physiology & Endurance Training Research',
        content: `
VO2max represents the maximum rate of oxygen consumption during exercise and is a strong predictor of cardiovascular health and longevity.

VO2max Reference Values (ml/kg/min):
Men:
- Excellent: >55
- Good: 45-55
- Fair: 35-45
- Poor: <35

Women:
- Excellent: >48
- Good: 38-48
- Fair: 30-38
- Poor: <30

VO2max declines approximately 10% per decade after age 30 without training intervention. Regular endurance training can slow this decline to 5% per decade or less.

Training to Increase VO2max:
1. Long slow distance (Zone 2): builds mitochondrial density, 1-3 sessions per week
2. Threshold training (Zone 3-4): 2x20 minutes at lactate threshold, 1-2 sessions per week
3. HIIT (Zone 5): 4x4 minutes at 90-95% max HR with 3 minutes recovery, 1 session per week
4. Polarized approach yields best results: 80% Zone 1-2, 20% Zone 4-5

VO2max can improve 10-20% in untrained individuals within 8-12 weeks of structured training. Trained athletes typically see 3-5% improvement per training cycle.

Factors affecting VO2max measurement/trends:
- Altitude: decreases ~2% per 300m above 1500m
- Hydration: dehydration reduces by 2-3%
- Sleep deprivation: reduces by 2-5%
- Overtraining: sustained decline of >5% suggests overtraining
    `.trim(),
    },
    {
        title: 'Running Form & Biomechanics Optimization',
        source: 'Running Mechanics & Gait Analysis Research',
        content: `
Running form directly impacts performance, injury risk, and running economy.

Key Biomechanical Metrics:
1. Ground Contact Time (GCT):
   - Elite runners: 160-200ms at race pace
   - Recreational: 200-270ms
   - Shorter GCT correlates with better running economy
   - GCT typically increases with fatigue (>20ms increase = form breakdown)

2. Vertical Oscillation:
   - Optimal: 6-10cm (too much = wasted energy, too little = shuffling)
   - >12cm: excessive bounce, redirecting energy upward instead of forward
   - <5cm: insufficient hip extension, shuffling gait

3. Running Power (Stryd/Watch-measured):
   - Represents total mechanical work per unit time
   - Better training metric than pace for hilly terrain
   - Critical Power (CP): power sustainable for ~40 minutes
   - Functional Threshold Power (FTP): power sustainable for ~60 minutes

4. Stride Length vs Cadence:
   - Optimal cadence: 170-185 steps per minute (most runners)
   - Overstriding (excessive stride length): increases braking forces and injury risk
   - Cadence should increase slightly (3-5%) on uphills and decrease on downhills

Injury Prevention through Form:
- Hip drop (Trendelenburg): >5° pelvic drop indicates weak gluteus medius
- Knee valgus (inward collapse): indicates weak hip external rotators
- Asymmetry >3% in any metric: address with unilateral strengthening
- Running form degrades measurably after 60-90 minutes of continuous running

Form Check Frequency:
- Video analysis every 4-6 weeks during training blocks
- More frequent during return-from-injury phases
- Key sessions to analyze: tempo runs and long runs (where fatigue reveals form issues)
    `.trim(),
    },
    {
        title: 'Daily Sunlight, Circadian Rhythm & Performance',
        source: 'Andrew Huberman, Circadian Biology & Performance Research',
        content: `
Light exposure is the primary zeitgeber (time-giver) for the circadian system. Proper light exposure dramatically impacts sleep quality, hormone production, and athletic performance.

Morning Light Protocol:
- 10-30 minutes of outdoor light within 30 minutes of waking
- Even on cloudy days, outdoor light is 10-50x brighter than indoor light
- Triggers cortisol pulse that sets circadian rhythm and promotes wakefulness
- Enhances dopamine production, improving motivation and drive for training
- Morning sunlight increases evening melatonin production by 50%+

Daytime Light:
- Minimum 30 minutes of outdoor time spread throughout the day
- Indoor environments: aim for bright, blue-enriched light during daylight hours
- Light exposure during daytime training enhances performance via alertness and mood

Evening Light Management:
- Dim lights 2-3 hours before bed
- Avoid overhead bright lights after sunset
- Blue-blocking glasses 90 minutes before bed improve sleep onset by 12 minutes on average
- Screen brightness should be at minimum comfortable level

Light and Athletic Performance:
- Bright light exposure pre-competition improves reaction time and power output
- Training in natural light improves mood and perceived exertion ratings
- Time-of-day performance peaks align with individual chronotype
- Jet lag protocol: morning light advances circadian clock, evening light delays it
- Each time zone crossed requires approximately 1 day of adaptation

Daytime light exposure (measured as time in daylight) is a key environmental biomarker. Less than 30 minutes of daylight is associated with poorer sleep quality and lower HRV the following night.
    `.trim(),
    },
    {
        title: 'Correlation Analysis: Habits & Biomarkers',
        source: 'Elite Health Analytics & Behavioral Research',
        content: `
Understanding how daily habits correlate with physiological markers is essential for optimizing health and performance.

Strong Positive Habits (associated with better recovery/performance):
1. Consistent sleep schedule (±30 minutes): +8-15% HRV, -3 bpm RHR
2. Morning sunlight (20+ minutes): +5-10% deep sleep, faster sleep onset
3. Hydration (>3L daily for men, >2.2L for women): +3-5% HRV
4. Cold exposure (2-3x weekly): +5-10% HRV within 4 weeks
5. Meditation (10+ minutes daily): +5-8% HRV, reduced cortisol
6. Protein at every meal (25-40g): improved recovery scores
7. Walking (8,000+ steps daily): improved cardiovascular markers
8. No alcohol: +15-25% REM sleep, +10-15% HRV

Habits that Negatively Impact Recovery:
1. Alcohol (any amount): -15-25% REM sleep, -10-20% HRV for 2-3 days
2. Late eating (<2 hours before bed): +3-8 bpm sleeping HR, +0.5-1.0°C skin temp
3. Inconsistent sleep timing: -10-15% HRV
4. Caffeine after 2pm: -15-20% deep sleep, +5-10 minute sleep latency
5. High evening stress: -10-20% HRV, +5-10 bpm RHR
6. Screen time before bed: -10-20% melatonin production

Correlation Strength Guide:
- Strong correlation (|r| > 0.7): Habit consistently predicts the biomarker
- Moderate correlation (|r| = 0.4-0.7): Habit meaningfully influences the biomarker
- Weak correlation (|r| = 0.2-0.4): Habit has some influence but other factors dominate
- No correlation (|r| < 0.2): Habit does not meaningfully predict this biomarker

Individual variation is significant. What works for one athlete may not work for another. Use personal correlation data to identify YOUR highest-leverage habits.
    `.trim(),
    },
]
