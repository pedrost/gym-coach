import { Exercise, EXERCISES, MuscleGroup } from './workoutData'

type Level = 'beginner' | 'intermediate' | 'advanced'

const DIFFICULTY_POOL: Record<Level, ('beginner' | 'intermediate' | 'advanced')[]> = {
  beginner: ['beginner'],
  intermediate: ['beginner', 'intermediate'],
  advanced: ['beginner', 'intermediate', 'advanced'],
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getWorkoutExercises(
  muscleGroups: MuscleGroup[],
  level: Level,
  dislikedIds: string[]
): Exercise[] {
  const allowed = DIFFICULTY_POOL[level]
  const result: Exercise[] = []

  for (const group of muscleGroups) {
    const pool = EXERCISES.filter(
      (e) =>
        e.muscleGroup === group &&
        allowed.includes(e.difficulty) &&
        !dislikedIds.includes(e.id)
    )
    const picked = shuffle(pool).slice(0, Math.min(4, pool.length))
    result.push(...picked)
  }

  return result
}

export function getReplacementExercise(
  current: Exercise,
  usedIds: string[],
  dislikedIds: string[],
  level: Level
): Exercise | null {
  const allowed = DIFFICULTY_POOL[level]
  const pool = EXERCISES.filter(
    (e) =>
      e.muscleGroup === current.muscleGroup &&
      e.id !== current.id &&
      !usedIds.includes(e.id) &&
      !dislikedIds.includes(e.id) &&
      allowed.includes(e.difficulty)
  )
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

export function getReducedExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    sets: Math.max(2, exercise.sets - 1),
    reps: Math.max(5, Math.round(exercise.reps * 0.7)),
  }
}

export function pickSuggestedGroup(level: Level): { group: MuscleGroup; reason: string } {
  const groups: MuscleGroup[] = ['back', 'chest', 'arms', 'legs', 'shoulders', 'core']
  const group = groups[Math.floor(Math.random() * groups.length)]
  const label = group.charAt(0).toUpperCase() + group.slice(1)

  const reasons: Record<Level, string> = {
    beginner: `I saw you're a beginner — let's start with ${label} today 💪`,
    intermediate: `Based on your level, ${label} is a perfect choice today 🔥`,
    advanced: `Let's crush ${label} — you're more than ready for it 💥`,
  }

  return { group, reason: reasons[level] }
}

export function estimateCalories(exercises: Exercise[]): number {
  return exercises.reduce((total, ex) => {
    const setsCalories = ex.sets * ex.reps * 0.5
    return total + Math.round(setsCalories)
  }, 0)
}

export function estimateMinutes(exercises: Exercise[]): number {
  return exercises.reduce((total, ex) => {
    const setTime = ex.sets * (0.5 + 1.5)
    return total + Math.round(setTime)
  }, 0)
}
