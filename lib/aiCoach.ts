import { MuscleGroup } from './workoutData'
import { UserProfile, WorkoutRecord } from './storage'

const OLLAMA_URL = 'http://localhost:11434'
const MODEL = 'qwen2.5:4b'

export type AIRecommendation = {
  group: MuscleGroup
  reason: string
  source: 'ai' | 'algorithm'
}

export const THINKING_PHRASES = [
  'Analyzing your training history...',
  'Reviewing your muscle balance...',
  'Checking your recovery data...',
  'Optimizing for your level...',
  'Computing your ideal workout...',
  'Consulting training science...',
  'Balancing volume and intensity...',
  'Almost ready...',
]

function buildPrompt(profile: UserProfile, history: WorkoutRecord[]): string {
  const recentGroups = history
    .slice(0, 5)
    .flatMap((w) => w.muscleGroups)
    .join(', ')

  return `You are a professional fitness coach. Recommend ONE muscle group to train today.

User profile:
- Name: ${profile.name}
- Sex: ${profile.sex}
- Height: ${profile.height}${profile.heightUnit}
- Weight: ${profile.weight}${profile.weightUnit}
- Experience level: ${profile.level}
- Recent sessions targeted: ${recentGroups || 'none yet'}

Rules:
- Prefer muscles NOT recently trained for recovery
- Match difficulty to experience level
- Be brief and motivating (max 15 words for reason)
- Valid groups: back, chest, arms, legs, shoulders, core

Respond ONLY with valid JSON, no other text:
{"group": "<one of the valid groups>", "reason": "<brief motivating reason>"}`
}

async function callOllama(prompt: string): Promise<AIRecommendation | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.7, num_predict: 80 },
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    const parsed = JSON.parse(data.response)

    const validGroups: MuscleGroup[] = ['back', 'chest', 'arms', 'legs', 'shoulders', 'core']
    if (!validGroups.includes(parsed.group)) return null

    return {
      group: parsed.group as MuscleGroup,
      reason: parsed.reason ?? 'Great choice for today.',
      source: 'ai',
    }
  } catch {
    return null
  }
}

function algorithmicRecommendation(
  profile: UserProfile,
  history: WorkoutRecord[]
): AIRecommendation {
  const allGroups: MuscleGroup[] = ['back', 'chest', 'arms', 'legs', 'shoulders', 'core']

  const recentlyTrained = new Set(
    history
      .slice(0, 3)
      .flatMap((w) => w.muscleGroups)
  )

  // Prefer groups not recently trained
  const fresh = allGroups.filter((g) => !recentlyTrained.has(g))
  const pool = fresh.length > 0 ? fresh : allGroups
  const group = pool[Math.floor(Math.random() * pool.length)]

  const label = group.charAt(0).toUpperCase() + group.slice(1)

  const reasons: Record<string, Record<MuscleGroup, string>> = {
    beginner: {
      back:      `I saw you're a beginner — let's build your Back foundation 💪`,
      chest:     `Perfect for beginners — Chest training builds great habits 🏋️`,
      arms:      `Arms are a great confidence builder — let's get started 💪`,
      legs:      `Leg day builds your entire foundation — beginner-friendly 🦵`,
      shoulders: `Shoulders give you that athletic look — let's build them 🔱`,
      core:      `Core strength is the foundation of all fitness — let's go 🎯`,
    },
    intermediate: {
      back:      `Back day — time to build that V-taper 🔥`,
      chest:     `Chest day — push your plateau further ⚡`,
      arms:      `Arms are due — let's get a sick pump 💪`,
      legs:      `Leg day builds your biggest muscles — let's attack it 🦵`,
      shoulders: `Shoulders haven't been hit recently — perfect timing 🔱`,
      core:      `Core work will level up every other lift 🎯`,
    },
    advanced: {
      back:      `Back day — time to move serious weight 💥`,
      chest:     `Chest day — let's push beyond your previous best 🔥`,
      arms:      `Arms are rested and ready — make every set count 💪`,
      legs:      `Leg day — the most demanding, the most rewarding 🦵`,
      shoulders: `Shoulders: rested and primed for a heavy session 🔱`,
      core:      `Core strength separates good athletes from great ones 🎯`,
    },
  }

  return {
    group,
    reason: reasons[profile.level][group],
    source: 'algorithm',
  }
}

export async function getAIRecommendation(
  profile: UserProfile,
  history: WorkoutRecord[]
): Promise<AIRecommendation> {
  const prompt = buildPrompt(profile, history)
  const aiResult = await callOllama(prompt)

  if (aiResult) return aiResult
  return algorithmicRecommendation(profile, history)
}
