import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C, MUSCLE_COLORS } from '../lib/theme'
import {
  getUserProfile,
  getDislikedExercises,
  getWorkoutHistory,
  UserProfile,
} from '../lib/storage'
import { getWorkoutExercises } from '../lib/workoutEngine'
import { setActiveWorkout } from '../lib/workoutStore'
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUP_ICONS, MuscleGroup } from '../lib/workoutData'
import { getAIRecommendation, THINKING_PHRASES } from '../lib/aiCoach'

const { width: W } = Dimensions.get('window')

type Focus = 'upper' | 'lower' | 'full'

const FOCUS_CONFIG: Record<Focus, {
  label: string; sub: string; icon: string; groups: MuscleGroup[]
}> = {
  upper: {
    label: 'Upper Body',
    sub:   'Back · Chest · Arms · Shoulders',
    icon:  '🏋️',
    groups: ['back', 'chest', 'arms', 'shoulders'],
  },
  lower: {
    label: 'Lower Body',
    sub:   'Legs · Core',
    icon:  '🦵',
    groups: ['legs', 'core'],
  },
  full: {
    label: 'Full Body',
    sub:   'All muscle groups',
    icon:  '⚡',
    groups: ['back', 'chest', 'arms', 'legs', 'shoulders', 'core'],
  },
}

// ─── AI Thinking Overlay ──────────────────────────────────────────────────────

function ThinkingOverlay({ visible, onDone, profile, history }: {
  visible: boolean
  onDone: (reason: string, group: MuscleGroup) => void
  profile: UserProfile
  history: Awaited<ReturnType<typeof getWorkoutHistory>>
}) {
  const [phraseIdx, setPhraseIdx] = useState(0)
  const overlayOpacity = useSharedValue(0)
  const cardScale      = useSharedValue(0.88)
  const spinAngle      = useSharedValue(0)
  const phraseOpacity  = useSharedValue(1)
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!visible) return

    overlayOpacity.value = withTiming(1, { duration: 260 })
    cardScale.value      = withSpring(1, { damping: 16 })
    spinAngle.value      = withRepeat(
      withTiming(360, { duration: 1100, easing: Easing.linear }),
      -1, false
    )

    setPhraseIdx(0)
    let idx = 0
    intervalRef.current = setInterval(() => {
      phraseOpacity.value = withSequence(
        withTiming(0, { duration: 180 }),
        withTiming(1, { duration: 180 })
      )
      idx = (idx + 1) % THINKING_PHRASES.length
      setTimeout(() => setPhraseIdx(idx), 180)
    }, 950)

    const minDelay = new Promise<void>((r) => setTimeout(r, 2600))
    const aiCall   = getAIRecommendation(profile, history)

    Promise.all([minDelay, aiCall]).then(([, result]) => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      overlayOpacity.value = withTiming(0, { duration: 220 })
      setTimeout(() => runOnJS(onDone)(result.reason, result.group), 220)
    })

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [visible])

  const overlayStyle  = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))
  const cardStyle     = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }))
  const spinStyle     = useAnimatedStyle(() => ({ transform: [{ rotate: `${spinAngle.value}deg` }] }))
  const phraseStyle   = useAnimatedStyle(() => ({ opacity: phraseOpacity.value }))

  if (!visible) return null

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, s.thinkOverlay, overlayStyle]}>
      <Animated.View style={[s.thinkCard, cardStyle]}>
        <Animated.View style={[s.thinkSpinner, spinStyle]} />
        <Text style={s.thinkTitle}>Your Coach is Thinking</Text>
        <Animated.Text style={[s.thinkPhrase, phraseStyle]}>
          {THINKING_PHRASES[phraseIdx]}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  )
}

// ─── Focus card with stagger animation ───────────────────────────────────────

function FocusCard({ icon, label, sub, index, onPress }: {
  icon: string; label: string; sub: string; index: number; onPress: () => void
}) {
  const opacity = useSharedValue(0)
  const y       = useSharedValue(28)
  const scale   = useSharedValue(1)

  useEffect(() => {
    opacity.value = withDelay(index * 110 + 180, withTiming(1, { duration: 360 }))
    y.value       = withDelay(index * 110 + 180, withTiming(0, { duration: 360 }))
  }, [])

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }))

  return (
    <Animated.View style={anim}>
      <TouchableOpacity
        style={s.focusCard}
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 80 }) }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14 }) }}
        activeOpacity={1}
      >
        <Text style={s.focusCardIcon}>{icon}</Text>
        <View style={s.focusCardBody}>
          <Text style={s.focusCardLabel}>{label}</Text>
          <Text style={s.focusCardSub}>{sub}</Text>
        </View>
        <Text style={s.focusCardArrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()
  const [profile, setProfile]               = useState<UserProfile | null>(null)
  const [history, setHistory]               = useState<Awaited<ReturnType<typeof getWorkoutHistory>>>([])
  const [focus, setFocus]                   = useState<Focus | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<Set<MuscleGroup>>(new Set())
  const [thinking, setThinking]             = useState(false)

  const headerOpacity = useSharedValue(0)
  const headerY       = useSharedValue(16)
  // Slides the two-panel row: 0 = focus step, -W = muscles step
  const slideX        = useSharedValue(0)

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false
      async function load() {
        const p = await getUserProfile()
        if (cancelled) return
        if (!p) { router.replace('/onboarding'); return }
        const h = await getWorkoutHistory()
        if (cancelled) return
        setProfile(p)
        setHistory(h)
        setFocus(null)
        setSelectedGroups(new Set())
        slideX.value = 0
        headerOpacity.value = withDelay(80,  withTiming(1, { duration: 480 }))
        headerY.value       = withDelay(80,  withTiming(0, { duration: 380 }))
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  const headerStyle = useAnimatedStyle(() => ({
    opacity:   headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }))

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }))

  function selectFocus(f: Focus) {
    setFocus(f)
    setSelectedGroups(new Set(FOCUS_CONFIG[f].groups))
    slideX.value = withTiming(-W, { duration: 320, easing: Easing.out(Easing.cubic) })
  }

  function goBack() {
    slideX.value = withTiming(0, { duration: 280, easing: Easing.in(Easing.cubic) })
  }

  function toggleGroup(g: MuscleGroup) {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  async function handleLetsGo(groups?: MuscleGroup[]) {
    if (!profile) return
    const chosen = groups ?? Array.from(selectedGroups)
    if (chosen.length === 0) return
    const disliked = await getDislikedExercises()
    const exercises = getWorkoutExercises(chosen, profile.level, disliked)
    setActiveWorkout({ exercises, muscleGroups: chosen })
    router.push('/workout')
  }

  async function onThinkingDone(reason: string, group: MuscleGroup) {
    setThinking(false)
    if (!profile) return
    const disliked  = await getDislikedExercises()
    const exercises = getWorkoutExercises([group], profile.level, disliked)
    setActiveWorkout({ exercises, muscleGroups: [group], chooseReason: reason })
    router.push('/workout')
  }

  const hasSelection = selectedGroups.size > 0

  if (!profile) return <View style={s.loading} />

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <Animated.View style={[s.header, headerStyle]}>
        <View>
          <Text style={s.greeting}>{getGreeting()}</Text>
          <Text style={s.name}>{profile.name} 👋</Text>
        </View>
        <TouchableOpacity
          style={s.dashBtn}
          onPress={() => router.push('/dashboard')}
          activeOpacity={0.8}
        >
          <Text style={s.dashBtnText}>📊</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Two-panel slide area ────────────────────────────────── */}
      {/* overflow:hidden clips the off-screen panel */}
      <View style={s.slideWrapper}>
        <Animated.View style={[s.slideRow, rowStyle]}>

          {/* ── Panel 1: Focus ─────────────────────────────────── */}
          <View style={s.panel}>
            <ScrollView
              style={s.scrollBg}
              contentContainerStyle={s.focusContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={s.panelTitle}>What's the focus today?</Text>
              <View style={s.focusCards}>
                {(Object.keys(FOCUS_CONFIG) as Focus[]).map((f, i) => (
                  <FocusCard
                    key={f}
                    icon={FOCUS_CONFIG[f].icon}
                    label={FOCUS_CONFIG[f].label}
                    sub={FOCUS_CONFIG[f].sub}
                    index={i}
                    onPress={() => selectFocus(f)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          {/* ── Panel 2: Muscles ───────────────────────────────── */}
          <View style={s.panel}>
            <ScrollView
              style={s.scrollBg}
              contentContainerStyle={s.musclesContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Back */}
              <TouchableOpacity style={s.backRow} onPress={goBack} activeOpacity={0.7}>
                <Text style={s.backArrow}>←</Text>
                <Text style={s.backLabel}>{focus ? FOCUS_CONFIG[focus].label : ''}</Text>
              </TouchableOpacity>

              <Text style={s.panelTitle}>Choose your muscles</Text>
              <Text style={s.panelSub}>Tap to toggle — pick one or more</Text>

              <View style={s.muscleGrid}>
                {(focus ? FOCUS_CONFIG[focus].groups : ([] as MuscleGroup[])).map((g) => {
                  const active = selectedGroups.has(g)
                  const color  = MUSCLE_COLORS[g]
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[
                        s.muscleCard,
                        active && { borderColor: color, backgroundColor: color + '18' },
                      ]}
                      onPress={() => toggleGroup(g)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.muscleIcon}>{MUSCLE_GROUP_ICONS[g]}</Text>
                      <Text style={[s.muscleLabel, active && { color }]}>
                        {MUSCLE_GROUP_LABELS[g]}
                      </Text>
                      {active && (
                        <View style={[s.muscleTick, { backgroundColor: color }]}>
                          <Text style={s.muscleTickText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>

              {hasSelection && (
                <Text style={s.selCount}>
                  {selectedGroups.size} group{selectedGroups.size > 1 ? 's' : ''} selected
                </Text>
              )}

              {/* Bottom padding so content isn't hidden behind the action bar */}
              <View style={{ height: 180, backgroundColor: C.bg }} />
            </ScrollView>

            {/* Floating action bar — inside the panel so it doesn't cover panel 1 */}
            <View style={s.actionBar}>
              <TouchableOpacity
                style={s.chooseBtn}
                onPress={() => setThinking(true)}
                activeOpacity={0.85}
              >
                <Text style={s.chooseBtnIcon}>🎲</Text>
                <View>
                  <Text style={s.chooseBtnTitle}>Choose it for me</Text>
                  <Text style={s.chooseBtnSub}>AI coach picks your workout</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.goBtn, !hasSelection && s.goBtnDisabled]}
                onPress={() => handleLetsGo()}
                disabled={!hasSelection}
                activeOpacity={0.9}
              >
                <Text style={s.goBtnText}>Let's Go →</Text>
              </TouchableOpacity>
            </View>
          </View>

        </Animated.View>
      </View>

      {/* AI overlay — full-screen, sits above everything */}
      {profile && (
        <ThinkingOverlay
          visible={thinking}
          profile={profile}
          history={history}
          onDone={onThinkingDone}
        />
      )}
    </SafeAreaView>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: C.bg,
  },
  greeting: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  name:     { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 2 },
  dashBtn: {
    width: 42, height: 42, backgroundColor: C.card,
    borderRadius: 13, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  dashBtnText: { fontSize: 19 },

  // Two-panel slide
  slideWrapper: {
    flex: 1,
    overflow: 'hidden',      // ← clips the offscreen panel
    backgroundColor: C.bg,  // ← prevents white flash
  },
  slideRow: {
    flex: 1,
    flexDirection: 'row',
    width: W * 2,   // explicit 2-panel width; overflow:hidden on wrapper clips it
  },
  panel: {
    width: W,
    flex: 0,
    backgroundColor: C.bg,
  },

  // Scroll views — explicit bg prevents white on overscroll
  scrollBg: {
    flex: 1,
    backgroundColor: C.bg,
  },
  focusContent: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 40,
    backgroundColor: C.bg,
  },
  musclesContent: {
    paddingHorizontal: 24,
    paddingTop: 4,
    backgroundColor: C.bg,
  },

  panelTitle: { fontSize: 21, fontWeight: '800', color: C.text, marginBottom: 6, marginTop: 4 },
  panelSub:   { fontSize: 13, color: C.textMuted, marginBottom: 16 },

  // Focus cards
  focusCards: { gap: 14, marginTop: 10 },
  focusCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  focusCardIcon:  { fontSize: 32 },
  focusCardBody:  { flex: 1 },
  focusCardLabel: { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 3 },
  focusCardSub:   { fontSize: 13, color: C.textMuted },
  focusCardArrow: { fontSize: 26, color: C.purple, fontWeight: '300' },

  // Back row
  backRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, marginTop: 4 },
  backArrow: { fontSize: 20, color: C.purple },
  backLabel: { fontSize: 16, fontWeight: '700', color: C.purple },

  // Muscle grid
  muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  muscleCard: {
    width: (W - 60) / 2,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 18,
    gap: 6,
  },
  muscleIcon:     { fontSize: 26 },
  muscleLabel:    { fontSize: 15, fontWeight: '700', color: C.textDim },
  muscleTick: {
    position: 'absolute', top: 12, right: 12,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  muscleTickText: { fontSize: 11, fontWeight: '800', color: '#000' },
  selCount:       { fontSize: 13, fontWeight: '600', color: C.purple, textAlign: 'center', marginTop: 4 },

  // Action bar — inside panel 2, so it only covers that panel
  actionBar: {
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 12,
  },
  chooseBtn: {
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chooseBtnIcon:  { fontSize: 24 },
  chooseBtnTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  chooseBtnSub:   { fontSize: 12, color: C.textMuted, marginTop: 2 },
  goBtn: {
    backgroundColor: C.purple,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
  },
  goBtnDisabled: { opacity: 0.32 },
  goBtnText:     { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: 0.2 },

  // AI thinking overlay
  thinkOverlay: {
    backgroundColor: 'rgba(13,17,23,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  thinkCard: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    padding: 40,
    alignItems: 'center',
    width: W - 64,
  },
  thinkSpinner: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 4, borderColor: C.purple,
    borderTopColor: 'transparent',
    marginBottom: 24,
  },
  thinkTitle:  { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 12, textAlign: 'center' },
  thinkPhrase: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
})
