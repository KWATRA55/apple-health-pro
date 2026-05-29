import { ALGORITHM_VERSION as BIOLOGICAL_AGE_VERSION, ALGORITHM_NAME as BIOLOGICAL_AGE_NAME } from './biological-age';
import { ALGORITHM_VERSION as CNS_STRESS_VERSION, ALGORITHM_NAME as CNS_STRESS_NAME } from './cns-stress';
import { ALGORITHM_VERSION as HABIT_IMPACT_VERSION, ALGORITHM_NAME as HABIT_IMPACT_NAME } from './habit-impact';
import { ALGORITHM_VERSION as HEURISTIC_SYNTHESIS_VERSION, ALGORITHM_NAME as HEURISTIC_SYNTHESIS_NAME } from './heuristic-synthesis';
import { ALGORITHM_VERSION as ILLNESS_PREDICTOR_VERSION, ALGORITHM_NAME as ILLNESS_PREDICTOR_NAME } from './illness-predictor';
import { ALGORITHM_VERSION as INJURY_PREDICTOR_VERSION, ALGORITHM_NAME as INJURY_PREDICTOR_NAME } from './injury-predictor';
import { ALGORITHM_VERSION as PEARSON_CORRELATION_VERSION, ALGORITHM_NAME as PEARSON_CORRELATION_NAME } from './pearson-correlation';
import { ALGORITHM_VERSION as RECOVERY_VERSION, ALGORITHM_NAME as RECOVERY_NAME } from './recovery';
import { ALGORITHM_VERSION as RUNNING_FORM_VERSION, ALGORITHM_NAME as RUNNING_FORM_NAME } from './running-form';
import { ALGORITHM_VERSION as SLEEP_DEBT_VERSION, ALGORITHM_NAME as SLEEP_DEBT_NAME } from './sleep-debt';
import { ALGORITHM_VERSION as SLEEP_PERFORMANCE_VERSION, ALGORITHM_NAME as SLEEP_PERFORMANCE_NAME } from './sleep-performance';
import { ALGORITHM_VERSION as STRAIN_VERSION, ALGORITHM_NAME as STRAIN_NAME } from './strain';
import { ALGORITHM_VERSION as STREAKS_VERSION, ALGORITHM_NAME as STREAKS_NAME } from './streaks';
import { ALGORITHM_VERSION as TREND_ENGINE_VERSION, ALGORITHM_NAME as TREND_ENGINE_NAME } from './trend-engine';
import { ALGORITHM_VERSION as WEEKLY_PLANNER_VERSION, ALGORITHM_NAME as WEEKLY_PLANNER_NAME } from './weekly-planner';
import { ALGORITHM_VERSION as Z_SCORE_VERSION, ALGORITHM_NAME as Z_SCORE_NAME } from './z-score';

export interface AlgorithmInfo {
    name: string;
    version: string;
    description: string;
    dependencies: string[];  // names of other algorithms this depends on
    inputDomains: string[];  // 'vitals', 'sleep', 'activity', 'mobility', etc.
}

export const ALGORITHM_REGISTRY: Record<string, AlgorithmInfo> = {
    'biological-age': {
        name: BIOLOGICAL_AGE_NAME,
        version: BIOLOGICAL_AGE_VERSION,
        description: 'Estimates biological age and pace of aging from vitals, sleep, and activity data',
        dependencies: [],
        inputDomains: ['vitals', 'sleep', 'activity', 'cardio_metabolic'],
    },
    'cns-stress': {
        name: CNS_STRESS_NAME,
        version: CNS_STRESS_VERSION,
        description: 'Computes CNS stress score from HRV suppression, audio load, and daylight deficit',
        dependencies: ['recovery'],
        inputDomains: ['vitals', 'environmental', 'sleep', 'cardio_metabolic'],
    },
    'habit-impact': {
        name: HABIT_IMPACT_NAME,
        version: HABIT_IMPACT_VERSION,
        description: 'Multi-dimensional habit impact engine correlating behaviors with next-day biometrics',
        dependencies: ['pearson-correlation'],
        inputDomains: ['vitals', 'sleep', 'scores', 'activity', 'environmental', 'journal'],
    },
    'heuristic-synthesis': {
        name: HEURISTIC_SYNTHESIS_NAME,
        version: HEURISTIC_SYNTHESIS_VERSION,
        description: 'Combines readiness, resilience, and longevity pillars into daily directives',
        dependencies: ['recovery', 'illness-predictor', 'injury-predictor', 'cns-stress', 'biological-age'],
        inputDomains: ['vitals', 'sleep', 'mobility', 'environmental', 'cardio_metabolic', 'scores', 'activity'],
    },
    'illness-predictor': {
        name: ILLNESS_PREDICTOR_NAME,
        version: ILLNESS_PREDICTOR_VERSION,
        description: 'Predicts illness risk from skin temperature, HRV, RHR, breathing disturbances, and SpO2',
        dependencies: [],
        inputDomains: ['vitals', 'cardio_metabolic'],
    },
    'injury-predictor': {
        name: INJURY_PREDICTOR_NAME,
        version: INJURY_PREDICTOR_VERSION,
        description: 'Analyzes gait biomechanics to estimate lower-limb injury risk',
        dependencies: [],
        inputDomains: ['mobility', 'running_dynamics'],
    },
    'pearson-correlation': {
        name: PEARSON_CORRELATION_NAME,
        version: PEARSON_CORRELATION_VERSION,
        description: 'Computes Pearson correlation coefficient and statistical significance',
        dependencies: [],
        inputDomains: [],
    },
    'recovery': {
        name: RECOVERY_NAME,
        version: RECOVERY_VERSION,
        description: 'Computes recovery score from HRV z-score, RHR z-score, and sleep quality factor',
        dependencies: ['z-score'],
        inputDomains: ['vitals', 'sleep'],
    },
    'running-form': {
        name: RUNNING_FORM_NAME,
        version: RUNNING_FORM_VERSION,
        description: 'Detects running form degradation via ground contact time and vertical oscillation',
        dependencies: [],
        inputDomains: ['running_dynamics'],
    },
    'sleep-debt': {
        name: SLEEP_DEBT_NAME,
        version: SLEEP_DEBT_VERSION,
        description: 'Computes cumulative sleep debt from past-week sleep records',
        dependencies: [],
        inputDomains: ['sleep'],
    },
    'sleep-performance': {
        name: SLEEP_PERFORMANCE_NAME,
        version: SLEEP_PERFORMANCE_VERSION,
        description: 'Scores sleep quality from REM/deep ratios, duration, and debt penalties',
        dependencies: [],
        inputDomains: ['sleep'],
    },
    'strain': {
        name: STRAIN_NAME,
        version: STRAIN_VERSION,
        description: 'Computes cardiovascular strain from HR zone distribution using weighted log model',
        dependencies: [],
        inputDomains: ['activity'],
    },
    'streaks': {
        name: STREAKS_NAME,
        version: STREAKS_VERSION,
        description: 'Computes rolling recovery, training, and HRV-positive streaks',
        dependencies: [],
        inputDomains: ['scores', 'activity'],
    },
    'trend-engine': {
        name: TREND_ENGINE_NAME,
        version: TREND_ENGINE_VERSION,
        description: 'Rolling trend analysis across 7d/14d/30d windows with pattern detection',
        dependencies: ['z-score'],
        inputDomains: ['vitals', 'sleep', 'scores', 'cardio_metabolic', 'mobility', 'environmental', 'weight'],
    },
    'weekly-planner': {
        name: WEEKLY_PLANNER_NAME,
        version: WEEKLY_PLANNER_VERSION,
        description: 'Generates a 7-day training plan with strain targets, workout types, and recovery protocols',
        dependencies: ['recovery', 'illness-predictor', 'injury-predictor', 'cns-stress'],
        inputDomains: ['scores', 'sleep', 'activity', 'environmental', 'journal'],
    },
    'z-score': {
        name: Z_SCORE_NAME,
        version: Z_SCORE_VERSION,
        description: 'Statistical functions: mean, stddev, z-score, and population z-score',
        dependencies: [],
        inputDomains: [],
    },
};

export function getAlgorithmVersion(name: string): string | null {
    return ALGORITHM_REGISTRY[name]?.version ?? null;
}
