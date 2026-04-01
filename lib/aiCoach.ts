import { MuscleGroup } from './workoutData'
import { UserProfile, WorkoutRecord } from './storage'

const OLLAMA_URL = 'http://localhost:11434'
const MODEL      = 'qwen2.5:4b'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FocusType = 'upper' | 'lower' | 'full'

export type FocusRecommendation = {
  focus:     FocusType
  reasoning: string      // 1 sentence, direct, uses user's name
  source:    'ai' | 'algorithm'
}

export type AIRecommendation = {
  group:  MuscleGroup
  reason: string
  source: 'ai' | 'algorithm'
}

// ─── Shared UI phrases ────────────────────────────────────────────────────────

export const ANALYSIS_PHRASES = [
  'Reading your workout history...',
  'Checking muscle recovery times...',
  'Analysing training balance...',
  'Reviewing your recent sessions...',
  'Computing optimal recovery...',
  'Consulting exercise science...',
]

export const THINKING_PHRASES = [
  'Analysing your training history...',
  'Reviewing your muscle balance...',
  'Checking your recovery data...',
  'Optimising for your level...',
  'Computing your ideal workout...',
  'Consulting training science...',
  'Balancing volume and intensity...',
  'Almost ready...',
]

// ─── Ollama helper ────────────────────────────────────────────────────────────

async function callOllama(prompt: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:   MODEL,
        prompt,
        stream:  false,
        format:  'json',
        options: { temperature: 0.65, num_predict: 120 },
      }),
      signal: controller.signal,
    })

    clearTimeout(timer)
    if (!res.ok) return null

    const data = await res.json()
    return data.response ?? null
  } catch {
    return null
  }
}

// ─── Focus recommendation (upper / lower / full body) ─────────────────────────

function buildFocusPrompt(profile: UserProfile, history: WorkoutRecord[]): string {
  // Build a dated history summary
  const now = Date.now()
  const historyLines = history.slice(0, 7).map((w) => {
    const daysAgo = Math.round((now - new Date(w.date).getTime()) / 86_400_000)
    const label   = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`
    const groups  = w.muscleGroups.join(', ')
    return `  - ${label}: ${groups}`
  }).join('\n') || '  - no sessions recorded yet'

  return `You are an expert personal trainer creating a daily training plan.

=== USER PROFILE ===
Name: ${profile.name}
Sex: ${profile.sex}
Experience level: ${profile.level}
Body weight: ${profile.weight} ${profile.weightUnit}

=== RECENT WORKOUT HISTORY (newest first) ===
${historyLines}

=== YOUR TASK ===
Decide which training FOCUS is best for ${profile.name} TODAY.

Focus definitions:
- "upper": targets Back, Chest, Arms, Shoulders
- "lower": targets Legs and Core
- "full":  targets all muscle groups (ideal after rest days, or for beginners)

=== REASONING RULES ===
1. Muscles need 48-72 hours of recovery after training.
2. "upper" groups (back, chest, arms, shoulders) share recovery — training any of them counts as "upper".
3. "lower" groups (legs, core) share recovery — training either counts as "lower".
4. If upper was trained < 2 days ago, prefer "lower" (or "full" if lower was also recent).
5. If lower was trained < 2 days ago, prefer "upper" (or "full" if upper was also recent).
6. If no history, recommend "full" to build habit.
7. Write reasoning as ONE sentence addressed directly to ${profile.name}.
8. Mention the specific history reason (e.g. "Since you trained back yesterday...").
9. End with a motivating phrase. Maximum 22 words total.

=== REQUIRED OUTPUT ===
Respond with ONLY valid JSON — no markdown, no explanation:
{"focus":"upper","reasoning":"Since you crushed legs yesterday, Pedro, your upper body is fully rested and ready to go!"}`
}

function algorithmicFocusRecommendation(
  profile: UserProfile,
  history:  WorkoutRecord[]
): FocusRecommendation {
  const now = Date.now()
  const DAY = 86_400_000

  const upperGroups = new Set<string>(['back', 'chest', 'arms', 'shoulders'])
  const lowerGroups = new Set<string>(['legs', 'core'])

  let lastUpperDays = 99
  let lastLowerDays = 99

  for (const w of history) {
    const days = (now - new Date(w.date).getTime()) / DAY
    for (const g of w.muscleGroups) {
      if (upperGroups.has(g) && days < lastUpperDays) lastUpperDays = days
      if (lowerGroups.has(g) && days < lastLowerDays) lastLowerDays = days
    }
  }

  const name = profile.name

  if (lastUpperDays < 2 && lastLowerDays < 2) {
    return {
      focus:     'full',
      reasoning: `Both upper and lower body need more rest, ${name} — a light full-body session is perfect today!`,
      source:    'algorithm',
    }
  }
  if (lastUpperDays < 2) {
    return {
      focus:     'lower',
      reasoning: `Since you trained upper body recently, ${name}, it's the perfect time to hit legs and core!`,
      source:    'algorithm',
    }
  }
  if (lastLowerDays < 2) {
    return {
      focus:     'upper',
      reasoning: `Legs are still recovering, ${name} — let's capitalise on that and hit upper body hard today!`,
      source:    'algorithm',
    }
  }
  if (lastUpperDays === 99 && lastLowerDays === 99) {
    return {
      focus:     'full',
      reasoning: `No sessions logged yet — a full-body workout is the best way to kick things off, ${name}!`,
      source:    'algorithm',
    }
  }
  // Both are rested — prefer whichever was trained longer ago
  if (lastUpperDays >= lastLowerDays) {
    return {
      focus:     'upper',
      reasoning: `Upper body has had a solid rest, ${name} — it's primed and ready for a great session today!`,
      source:    'algorithm',
    }
  }
  return {
    focus:     'lower',
    reasoning: `Lower body is fully recovered, ${name} — let's make the most of it with a strong leg day!`,
    source:    'algorithm',
  }
}

export async function getFocusRecommendation(
  profile: UserProfile,
  history: WorkoutRecord[]
): Promise<FocusRecommendation> {
  const prompt = buildFocusPrompt(profile, history)
  const raw    = await callOllama(prompt)

  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      const validFocuses: FocusType[] = ['upper', 'lower', 'full']
      if (validFocuses.includes(parsed.focus) && typeof parsed.reasoning === 'string') {
        return { focus: parsed.focus as FocusType, reasoning: parsed.reasoning, source: 'ai' }
      }
    } catch { /* fall through to algorithm */ }
  }

  return algorithmicFocusRecommendation(profile, history)
}

// ─── Muscle-group recommendation (Panel 2 "choose for me") ───────────────────

function buildMusclePrompt(profile: UserProfile, history: WorkoutRecord[]): string {
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

function algorithmicMuscleRecommendation(
  profile: UserProfile,
  history: WorkoutRecord[]
): AIRecommendation {
  const allGroups: MuscleGroup[] = ['back', 'chest', 'arms', 'legs', 'shoulders', 'core']

  const recentlyTrained = new Set(
    history.slice(0, 3).flatMap((w) => w.muscleGroups)
  )

  const fresh = allGroups.filter((g) => !recentlyTrained.has(g))
  const pool  = fresh.length > 0 ? fresh : allGroups
  const group = pool[Math.floor(Math.random() * pool.length)]

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

  return { group, reason: reasons[profile.level][group], source: 'algorithm' }
}

export async function getAIRecommendation(
  profile: UserProfile,
  history: WorkoutRecord[]
): Promise<AIRecommendation> {
  const prompt = buildMusclePrompt(profile, history)
  const raw    = await callOllama(prompt)

  if (raw) {
    try {
      const parsed     = JSON.parse(raw)
      const validGroups: MuscleGroup[] = ['back', 'chest', 'arms', 'legs', 'shoulders', 'core']
      if (validGroups.includes(parsed.group)) {
        return { group: parsed.group as MuscleGroup, reason: parsed.reason ?? 'Great choice for today.', source: 'ai' }
      }
    } catch { /* fall through */ }
  }

  return algorithmicMuscleRecommendation(profile, history)
}
