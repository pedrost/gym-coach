import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  PROFILE:  'gc_profile',
  DISLIKED: 'gc_disliked_exercises',
  HISTORY:  'gc_workout_history_v2',
  WEIGHTS:  'gc_exercise_weights',
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  name: string
  sex: 'male' | 'female' | 'prefer_not'
  height: number
  heightUnit: 'cm' | 'ft'
  weight: number
  weightUnit: 'kg' | 'lbs'
  level: 'beginner' | 'intermediate' | 'advanced'
}

export type SetRecord = {
  setNumber: number
  repsCompleted: number
  weightKg: number
}

export type ExerciseRecord = {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  sets: SetRecord[]
  skipped: boolean
}

export type WorkoutRecord = {
  id: string
  date: string
  muscleGroups: string[]
  exercises: ExerciseRecord[]
  durationMinutes: number
  totalSets: number
  totalVolumeKg: number
  estimatedCalories: number
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PROFILE)
    return raw ? (JSON.parse(raw) as UserProfile) : null
  } catch {
    return null
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(profile))
}

// ─── Disliked exercises ───────────────────────────────────────────────────────

export async function getDislikedExercises(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.DISLIKED)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export async function addDislikedExercise(exerciseId: string): Promise<void> {
  const current = await getDislikedExercises()
  if (!current.includes(exerciseId)) {
    await AsyncStorage.setItem(KEYS.DISLIKED, JSON.stringify([...current, exerciseId]))
  }
}

// ─── Workout history ──────────────────────────────────────────────────────────

export async function getWorkoutHistory(): Promise<WorkoutRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HISTORY)
    return raw ? (JSON.parse(raw) as WorkoutRecord[]) : []
  } catch {
    return []
  }
}

export async function saveWorkoutRecord(record: WorkoutRecord): Promise<void> {
  try {
    const history = await getWorkoutHistory()
    history.unshift(record)
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history.slice(0, 100)))
  } catch {
    // ignore
  }
}

// ─── Per-exercise last used weight ────────────────────────────────────────────

export async function getLastWeightForExercise(exerciseId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WEIGHTS)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    return map[exerciseId] ?? 0
  } catch {
    return 0
  }
}

export async function saveWeightForExercise(exerciseId: string, weightKg: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.WEIGHTS)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    map[exerciseId] = weightKg
    await AsyncStorage.setItem(KEYS.WEIGHTS, JSON.stringify(map))
  } catch {
    // ignore
  }
}

// ─── Dashboard aggregates ─────────────────────────────────────────────────────

export type DashboardStats = {
  totalWorkouts: number
  totalSets: number
  totalVolumeKg: number
  muscleFrequency: Record<string, number>
  personalRecords: Record<string, { weightKg: number; date: string }>
  recentWorkouts: WorkoutRecord[]
  weeklyVolume: number[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const history = await getWorkoutHistory()

  const totalWorkouts = history.length
  const totalSets = history.reduce((s, w) => s + w.totalSets, 0)
  const totalVolumeKg = history.reduce((s, w) => s + w.totalVolumeKg, 0)

  // Muscle frequency (all time)
  const muscleFrequency: Record<string, number> = {}
  for (const w of history) {
    for (const g of w.muscleGroups) {
      muscleFrequency[g] = (muscleFrequency[g] ?? 0) + 1
    }
  }

  // Personal records (best weight per exercise)
  const personalRecords: Record<string, { weightKg: number; date: string }> = {}
  for (const w of history) {
    for (const ex of w.exercises) {
      const best = ex.sets.reduce((max, s) => Math.max(max, s.weightKg), 0)
      if (best > 0) {
        const current = personalRecords[ex.exerciseId]
        if (!current || best > current.weightKg) {
          personalRecords[ex.exerciseId] = { weightKg: best, date: w.date }
        }
      }
    }
  }

  // Weekly volume for the last 8 weeks
  const weeklyVolume: number[] = Array(8).fill(0)
  const now = Date.now()
  const WEEK = 7 * 24 * 60 * 60 * 1000
  for (const w of history) {
    const age = now - new Date(w.date).getTime()
    const weekIndex = Math.floor(age / WEEK)
    if (weekIndex < 8) {
      weeklyVolume[7 - weekIndex] += w.totalVolumeKg
    }
  }

  return {
    totalWorkouts,
    totalSets,
    totalVolumeKg: Math.round(totalVolumeKg),
    muscleFrequency,
    personalRecords,
    recentWorkouts: history.slice(0, 10),
    weeklyVolume,
  }
}
