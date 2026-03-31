import { Exercise } from './workoutData'

type ActiveWorkout = {
  exercises: Exercise[]
  muscleGroups: string[]
}

type CompletedWorkout = {
  userName: string
  exercisesCompleted: number
  totalSets: number
  estimatedCalories: number
  muscleGroups: string[]
}

let _active: ActiveWorkout | null = null
let _completed: CompletedWorkout | null = null

export function setActiveWorkout(data: ActiveWorkout): void {
  _active = data
}

export function getActiveWorkout(): ActiveWorkout | null {
  return _active
}

export function clearActiveWorkout(): void {
  _active = null
}

export function setCompletedWorkout(data: CompletedWorkout): void {
  _completed = data
}

export function getCompletedWorkout(): CompletedWorkout | null {
  return _completed
}

export function clearCompletedWorkout(): void {
  _completed = null
}
