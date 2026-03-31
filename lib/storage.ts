import AsyncStorage from '@react-native-async-storage/async-storage'

const KEYS = {
  PROFILE: 'gc_profile',
  DISLIKED: 'gc_disliked_exercises',
  HISTORY: 'gc_workout_history',
}

export type UserProfile = {
  name: string
  sex: 'male' | 'female' | 'prefer_not'
  height: number
  heightUnit: 'cm' | 'ft'
  weight: number
  weightUnit: 'kg' | 'lbs'
  level: 'beginner' | 'intermediate' | 'advanced'
}

export type WorkoutRecord = {
  id: string
  date: string
  muscleGroups: string[]
  exercisesCompleted: number
  totalSets: number
  estimatedCalories: number
}

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

export async function saveWorkoutRecord(record: WorkoutRecord): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HISTORY)
    const history: WorkoutRecord[] = raw ? JSON.parse(raw) : []
    history.unshift(record)
    await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history.slice(0, 50)))
  } catch {
    // ignore
  }
}
