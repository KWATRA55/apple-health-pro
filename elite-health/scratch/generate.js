import {
  useHealthStore,
  computeSynthesis,
  computeTrendReportSelector,
} from "../src/lib/store";
import {
  safeBiologicalAge,
  safeHRV,
  safeRHR,
  safeSpO2,
  safeRespiratoryRate,
  safeSkinTempDelta,
  safeVO2Max,
  safeNumber,
  safePaceOfAging,
  safeSleepDurationHours,
  safeSleepDebtHours,
  safeSteps,
  safeWalkingSpeed,
  safeDaylightMins,
  safeAudioLevel,
} from "../src/lib/utils/display-helpers";

// Helpers
function v(label, opts = {}) {
  return {
    label,
    display_value: opts.display ?? "--",
    numeric_value: opts.num ?? null,
    unit: opts.unit ?? null,
    value_kind: opts.kind ?? "empty_state",
    source: {
      kind: opts.srcKind ?? "unknown",
      store_selector: opts.srcSelector ?? null,
      db_table: opts.srcTable ?? null,
      algorithm: opts.srcAlgo ?? null,
    },
    notes: opts.notes ?? null,
  };
}
function ex(text, kind = "empty_state") {
  return { visible_text: text, kind };
}
function tap(label, type, dest, works = true, notes = []) {
  return {
    target_label: label,
    tap_type: type,
    destination: dest,
    works,
    notes,
  };
}
function srcOk(consistent = true, conflicts = [], notes = []) {
  return {
    appears_consistent_with_page: consistent,
    conflicts_with: conflicts,
    notes,
  };
}

export async function generateRuntimeSnapshot(doSync = false) {
  const store = useHealthStore.getState();

  if (!store._dbLoaded) {
    try {
      await store.loadFromDB();
    } catch (e) {
      console.warn("DB Load error:", e);
    }
  }

  if (doSync) {
    try {
      await store.syncHealthKit();
    } catch (e) {
      console.warn("Sync error:", e);
    }
  }

  const state = useHealthStore.getState();
  const trendReport = computeTrendReportSelector(state);

  const getLocalDateStr = (d) => {
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split("T")[0];
  };

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 86400000 * 2);

  const targetDates = [
    { label: "today", date: getLocalDateStr(now) },
    { label: "tomorrow", date: getLocalDateStr(tomorrow) },
    { label: "yesterday", date: getLocalDateStr(yesterday) },
    { label: "2_days_ago", date: getLocalDateStr(twoDaysAgo) },
  ];

  const dates_with_no_data = [];
  const fallback_sections = [];

  const generatedDates = targetDates.map(({ label, date: dateStr }) => {
    const isToday = label === "today";
    const isTomorrow = label === "tomorrow";
    const dateLabel = isToday
      ? "TODAY"
      : new Date(dateStr + "T00:00:00")
          .toLocaleDateString("en-US", { month: "short", day: "numeric" })
          .toUpperCase();

    const synthesis = computeSynthesis(state, dateStr);

    const currentScores = state.scores.find((s) => s.date === dateStr) || null;
    const currentVitals =
      state.vitals.find((v) => v.timestamp.startsWith(dateStr)) || null;
    const currentSleep = state.sleep.find((s) => s.date === dateStr) || null;
    const currentActivities = state.activities.filter((a) =>
      a.timestamp.startsWith(dateStr),
    );
    const currentMobility =
      state.mobility.find((m) => m.date === dateStr) || null;
    const currentEnvironmental =
      state.environmental.find((e) => e.date === dateStr) || null;
    const currentCardio =
      state.cardioMetabolic.find((c) => c.date === dateStr) || null;
    const currentDynamics =
      state.runningDynamics.find((r) => r.timestamp.startsWith(dateStr)) ||
      null;

    const hasData =
      currentScores ||
      currentVitals ||
      currentSleep ||
      currentActivities.length > 0 ||
      currentMobility ||
      currentEnvironmental ||
      currentCardio;
    if (!hasData) {
      dates_with_no_data.push(dateStr);
    }

    const chronoAge = state.profileAge ?? 25;

    const bioAgeRaw = currentScores?.biologicalAge;
    const bioAgeNum = safeBiologicalAge(bioAgeRaw, chronoAge) ?? chronoAge;
    const bioAgeIsFallback = bioAgeRaw == null || Number.isNaN(bioAgeRaw);

    const paceRaw = currentScores?.paceOfAging;
    const paceNum = safePaceOfAging(paceRaw) ?? 1.0;
    const paceIsFallback = paceRaw == null || Number.isNaN(paceRaw);

    if (bioAgeIsFallback || paceIsFallback) {
      fallback_sections.push(`${dateStr} - LongevityHero`);
    }

    return {
      label,
      date: dateStr,
      raw_payloads: {
        currentScores,
        currentVitals,
        currentSleep,
        currentActivities,
        currentMobility,
        currentCardio,
        currentEnvironmental,
        synthesis,
        interceptTriggers: synthesis?.interceptTriggers ?? [],
      },
      pages: {
        home: {
          visible: true,
          selected_date: dateStr,
          screen_title: "ELITE HEALTH",
          tab: "home",
          header: {
            date_selector: {
              visible_label: dateLabel,
              is_today: isToday,
              can_go_next: !isToday,
            },
            sync_state: {
              visible_text: state.lastSync
                ? `Updated ${new Date(state.lastSync).toLocaleTimeString()}`
                : "Needs sync",
              is_syncing: state.isSyncing,
            },
          },
          sections: [
            {
              section_key: "longevity_hero",
              section_title: "Longevity Sphere",
              state: bioAgeIsFallback ? "fallback" : "normal",
              values: [
                v("Biological Age", {
                  display: String(bioAgeNum),
                  num: bioAgeNum,
                  unit: "years",
                  kind: bioAgeIsFallback ? "fallback" : "derived",
                  srcKind: "store",
                  srcSelector: "currentScores?.biologicalAge",
                  srcTable: "daily_scores",
                  srcAlgo: "computeBiologicalAge",
                }),
                v("Pace of Aging", {
                  display: paceNum.toFixed(2),
                  num: paceNum,
                  unit: "x",
                  kind: paceIsFallback ? "fallback" : "derived",
                  srcKind: "store",
                  srcSelector: "currentScores?.paceOfAging",
                  srcTable: "daily_scores",
                  srcAlgo: "computeBiologicalAge",
                }),
              ],
              explanations: bioAgeIsFallback
                ? [ex("Awaiting recent longevity inputs", "fallback")]
                : [],
            },
            {
              section_key: "insight_priority_stack",
              section_title: "Why Today Looks Like This",
              state:
                synthesis && synthesis.interceptTriggers.length > 0
                  ? "normal"
                  : "empty",
              values: [],
              explanations: synthesis
                ? []
                : [
                    ex(
                      "No synthesis data — insights populate after HealthKit sync",
                      "empty_state",
                    ),
                  ],
            },
            {
              section_key: "daily_directive",
              section_title: "Today's Decision Stack",
              state: synthesis ? "normal" : "empty",
              values: [],
              explanations: synthesis
                ? []
                : [ex("Awaiting Data", "empty_state")],
            },
            {
              section_key: "training_window",
              section_title: "Training Window",
              state: synthesis ? "normal" : "empty",
              values: [],
              explanations: synthesis
                ? []
                : [
                    ex(
                      "Training Window · Awaiting HealthKit sync",
                      "empty_state",
                    ),
                  ],
            },
            {
              section_key: "health_pillars",
              section_title: "Health Pillars",
              state: synthesis ? "normal" : "empty",
              values: synthesis
                ? [
                    v("Readiness Score", {
                      num: synthesis.readiness.score,
                      display: String(synthesis.readiness.score),
                      kind: "derived",
                    }),
                    v("Resilience Score", {
                      num: synthesis.resilience.score,
                      display: String(synthesis.resilience.score),
                      kind: "derived",
                    }),
                    v("Longevity Score", {
                      num: synthesis.longevity.score,
                      display: String(synthesis.longevity.score),
                      kind: "derived",
                    }),
                  ]
                : [],
              explanations: synthesis
                ? []
                : [ex("Awaiting data", "empty_state")],
            },
            {
              section_key: "body_systems_status",
              section_title: "Body Systems",
              state: currentVitals ? "normal" : "empty",
              values: currentVitals
                ? [
                    v("HRV", {
                      num: safeHRV(currentVitals.hrv),
                      display: safeNumber(safeHRV(currentVitals.hrv)),
                    }),
                    v("RHR", {
                      num: safeRHR(currentVitals.rhr),
                      display: safeNumber(safeRHR(currentVitals.rhr)),
                    }),
                  ]
                : [],
              explanations: currentVitals
                ? []
                : [ex("Awaiting vitals data", "empty_state")],
            },
            {
              section_key: "trends_and_recovery",
              section_title: "Trends & Recovery",
              state: currentScores ? "normal" : "empty",
              values: [],
            },
            {
              section_key: "sleep_summary",
              section_title: "Sleep",
              state: currentSleep ? "normal" : "empty",
              values: currentSleep
                ? [
                    v("Duration", {
                      num: currentSleep.totalDurationMins,
                      display: String(currentSleep.totalDurationMins),
                    }),
                  ]
                : [],
            },
            {
              section_key: "todays_timeline",
              section_title: `${isToday ? "Today" : dateLabel}'s Timeline`,
              state: currentActivities.length > 0 ? "normal" : "empty",
              values: currentActivities.map((a, idx) =>
                v(`Activity ${idx + 1}`, {
                  display: `${a.workoutType} - ${a.durationMins}m`,
                  num: a.durationMins,
                }),
              ),
              explanations:
                currentActivities.length > 0
                  ? []
                  : [
                      ex(
                        "No activities logged · Sync HealthKit or log a workout",
                        "empty_state",
                      ),
                    ],
            },
            {
              section_key: "weekly_planner",
              section_title: "Weekly Planner",
              state: "normal",
              values: [],
            },
            {
              section_key: "streaks",
              section_title: "Streaks",
              state: state.scores.length > 0 ? "normal" : "empty",
              values: [],
            },
          ],
        },
        health: {
          visible: true,
          selected_date: dateStr,
          screen_title: "Health",
          tab: "health",
          subtabs: {
            overview: [
              {
                section_key: "biological_age",
                section_title: "Biological Age",
                state: bioAgeIsFallback ? "fallback" : "normal",
                values: [
                  v("Biological Age", {
                    display: String(bioAgeNum),
                    num: bioAgeNum,
                    unit: "years",
                    kind: bioAgeIsFallback ? "fallback" : "derived",
                    srcSelector: "currentScores?.biologicalAge",
                  }),
                  v("Chronological Age", {
                    display: String(chronoAge),
                    num: chronoAge,
                    unit: "y",
                    kind: "fallback",
                    srcSelector: "profileAge ?? 25",
                  }),
                ],
              },
              {
                section_key: "recovery_score",
                section_title: "Recovery Score",
                state: currentScores?.recoveryScore ? "normal" : "empty",
                values: [
                  v("Recovery Score", {
                    display: safeNumber(currentScores?.recoveryScore),
                    num: currentScores?.recoveryScore ?? null,
                    kind: currentScores?.recoveryScore
                      ? "derived"
                      : "empty_state",
                    srcSelector: "currentScores?.recoveryScore",
                  }),
                ],
              },
              {
                section_key: "sleep",
                section_title: "Sleep",
                state: currentSleep ? "normal" : "empty",
                values: currentSleep
                  ? [
                      v("Duration", {
                        num: currentSleep.totalDurationMins,
                        display: String(currentSleep.totalDurationMins),
                        unit: "m",
                      }),
                      v("Debt", {
                        num: currentScores?.sleepDebtHours,
                        display: String(currentScores?.sleepDebtHours),
                        unit: "h",
                      }),
                    ]
                  : [],
              },
              {
                section_key: "body_systems",
                section_title: "Body Systems",
                state: currentVitals ? "normal" : "empty",
                values: currentVitals
                  ? [
                      v("Cardio", {
                        srcSelector: "currentVitals.rhr",
                        srcTable: "vitals",
                      }),
                      v("Autonomic", {
                        srcSelector: "currentVitals.hrv",
                        srcTable: "vitals",
                      }),
                    ]
                  : [],
              },
              {
                section_key: "core_vitals",
                section_title: "Core Vitals",
                state: currentVitals ? "normal" : "empty",
                values: [
                  v("HRV", {
                    unit: "ms",
                    display: safeNumber(safeHRV(currentVitals?.hrv)),
                    num: safeHRV(currentVitals?.hrv),
                  }),
                  v("RHR", {
                    unit: "bpm",
                    display: safeNumber(safeRHR(currentVitals?.rhr)),
                    num: safeRHR(currentVitals?.rhr),
                  }),
                  v("SpO2", {
                    unit: "%",
                    display: safeNumber(safeSpO2(currentVitals?.spo2)),
                    num: safeSpO2(currentVitals?.spo2),
                  }),
                  v("Resp Rate", {
                    unit: "br/m",
                    display: safeNumber(
                      safeRespiratoryRate(currentVitals?.respiratoryRate),
                    ),
                    num: safeRespiratoryRate(currentVitals?.respiratoryRate),
                  }),
                  v("Skin Temp", {
                    unit: "°C",
                    display: safeNumber(
                      safeSkinTempDelta(currentVitals?.skinTempDelta),
                    ),
                    num: safeSkinTempDelta(currentVitals?.skinTempDelta),
                  }),
                ],
              },
              {
                section_key: "cardiac_strain",
                section_title: "Cardiac Strain",
                state: currentScores?.strainScore != null ? "normal" : "empty",
                values: [
                  v("Cardiac Strain", {
                    display:
                      currentScores?.strainScore != null
                        ? String(currentScores.strainScore)
                        : "--",
                    num: currentScores?.strainScore ?? 0,
                    unit: "/ 21.0",
                    srcSelector: "currentScores?.strainScore",
                  }),
                ],
              },
              {
                section_key: "running_dynamics",
                section_title: "Running Dynamics",
                state: currentDynamics?.runningPower > 0 ? "normal" : "empty",
                values:
                  currentDynamics?.runningPower > 0
                    ? [v("Power", { num: currentDynamics.runningPower })]
                    : [],
              },
              {
                section_key: "trend_explorer",
                section_title: "Trend Explorer — All Metrics",
                state: "normal",
                values: [],
              },
            ],
            readiness: [
              {
                section_key: "recovery_hero",
                section_title: "Recovery Score Hero",
                state: currentScores?.recoveryScore ? "normal" : "empty",
                values: [
                  v("Recovery Score", {
                    srcSelector: "currentScores?.recoveryScore",
                    num: currentScores?.recoveryScore,
                  }),
                  v("Recovery Zone", {
                    srcSelector: "currentScores?.recoveryZone",
                  }),
                ],
              },
              {
                section_key: "rhr_hrv_modules",
                section_title: "RHR & HRV Cards",
                state: currentVitals ? "normal" : "empty",
                values: [
                  v("RHR", {
                    unit: "bpm",
                    srcSelector: "safeRHR(currentVitals?.rhr)",
                    num: safeRHR(currentVitals?.rhr),
                  }),
                  v("HRV", {
                    unit: "ms",
                    srcSelector: "safeHRV(currentVitals?.hrv)",
                    num: safeHRV(currentVitals?.hrv),
                  }),
                ],
              },
              {
                section_key: "supporting_vitals",
                section_title: "Supporting Vitals",
                state: currentVitals ? "normal" : "empty",
                values: [
                  v("SpO2", {
                    unit: "%",
                    srcSelector: "safeSpO2(currentVitals?.spo2)",
                  }),
                  v("Resp Rate", {
                    unit: "br/m",
                    srcSelector:
                      "safeRespiratoryRate(currentVitals?.respiratoryRate)",
                  }),
                  v("Skin Temp", {
                    unit: "°C",
                    srcSelector:
                      "safeSkinTempDelta(currentVitals?.skinTempDelta)",
                  }),
                ],
              },
              {
                section_key: "readiness_cns",
                section_title: "CNS Readiness",
                state: state.cnsStressScore ? "normal" : "empty",
                values: [
                  v("CNS Status", { srcSelector: "cnsStressScore.risk" }),
                ],
              },
            ],
            resilience: [
              {
                section_key: "defense_status_grid",
                section_title: "Defense Status",
                state: currentScores ? "normal" : "empty",
                values: [
                  v("Immune Risk", {
                    srcSelector: "currentScores?.immunityRisk",
                  }),
                  v("Injury Risk", { srcSelector: "injuryRisk.risk" }),
                ],
              },
              {
                section_key: "cns_load_gauge",
                section_title: "CNS Load",
                state: state.cnsStressScore ? "normal" : "empty",
                values: [
                  v("Audio Load", { srcSelector: "cnsStressScore.audioLoad" }),
                  v("Daylight Deficit", {
                    srcSelector: "cnsStressScore.daylightDeficit",
                  }),
                ],
              },
              {
                section_key: "body_details",
                section_title: "Body Details",
                state:
                  currentMobility || currentEnvironmental || currentCardio
                    ? "normal"
                    : "empty",
                values: [
                  v("Walking Asymmetry", {
                    srcSelector: "mobilityRecord?.walkingAsymmetry",
                  }),
                  v("VO2 Max", {
                    srcSelector: "safeVO2Max(cardioRecord?.vo2Max)",
                  }),
                ],
              },
            ],
            longevity: [
              {
                section_key: "biological_vs_chronological",
                section_title: "Biological vs Chronological",
                state: bioAgeIsFallback ? "fallback" : "normal",
                values: [
                  v("Biological Age", {
                    num: bioAgeNum,
                    srcSelector: "currentScores?.biologicalAge",
                  }),
                  v("Pace of Aging", {
                    num: paceNum,
                    srcSelector: "currentScores?.paceOfAging",
                  }),
                ],
              },
              {
                section_key: "protocol_adherence",
                section_title: "AI Protocol Adherence",
                state: "normal",
                values: [
                  v("Bedtime before 11 PM", {
                    srcSelector: "currentScores?.sleepDebtHours",
                  }),
                ],
              },
            ],
          },
        },
        coach: {
          visible: true,
          selected_date: dateStr,
          screen_title: "Coach",
          sections: [
            {
              section_key: "chat_interface",
              state: "empty",
              values: [],
            },
            {
              section_key: "biometrics_context_widget",
              state:
                currentScores?.recoveryScore != null ||
                currentScores?.strainScore != null
                  ? "normal"
                  : "empty",
              values: [
                v("Recovery", { srcSelector: "latestScores?.recoveryScore" }),
                v("Strain", { srcSelector: "latestScores?.strainScore" }),
              ],
            },
          ],
        },
        profile: {
          visible: true,
          selected_date: dateStr,
          screen_title: "Profile",
          sections: [
            {
              section_key: "athlete_identity",
              state: "normal",
              values: [
                v("Workout Count", { num: state.activities.length }),
                v("Active Days", { num: state.scores.length }),
              ],
            },
            {
              section_key: "personal_records",
              state: "normal",
              values: [
                v("Max Strain", {
                  srcSelector:
                    "activities.reduce(max, a => max(a.strainScore ?? 0), 0)",
                }),
              ],
            },
          ],
        },
      },
    };
  });

  const result = {
    snapshot_type: "runtime_state_dump",
    data_origin: "sqlite | zustand | healthkit_runtime | mixed",
    generated_from_runtime: true,
    fallback_sections: fallback_sections,
    dates_with_no_data: dates_with_no_data,
    app_info: {
      app_name: "Elite Health",
      snapshot_generated_at: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    dates: generatedDates,
  };

  return result;
}
