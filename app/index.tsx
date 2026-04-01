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
type Step = 'focus' | 'muscles'

const FOCUS_CONFIG: Record<Focus, { label: string; sub: string; icon: string; groups: MuscleGroup[] }> = {
  upper: {
    label: 'Upper Body',
    sub: 'Back · Chest · Arms · Shoulders',
    icon: '🏋️',
    groups: ['back', 'chest', 'arms', 'shoulders'],
  },
  lower: {
    label: 'Lower Body',
    sub: 'Legs · Core',
    icon: '🦵',
    groups: ['legs', 'core'],
  },
  full: {
    label: 'Full Body',
    sub: 'All muscle groups',
    icon: '⚡',
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
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.85)
  const dotRotate = useSharedValue(0)
  const phraseOpacity = useSharedValue(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!visible) return

    opacity.value = withTiming(1, { duration: 300 })
    scale.value = withSpring(1, { damping: 16 })
    dotRotate.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1, false
    )

    setPhraseIdx(0)
    let idx = 0
    intervalRef.current = setInterval(() => {
      phraseOpacity.value = withSequence(
        withTiming(0, { duration: 200 }),
        withTiming(1, { duration: 200 })
      )
      idx = (idx + 1) % THINKING_PHRASES.length
      setTimeout(() => setPhraseIdx(idx), 200)
    }, 900)

    const minWait = new Promise<void>((res) => setTimeout(res, 2500))
    const aiCall = getAIRecommendation(profile, history)

    Promise.all([minWait, aiCall]).then(([, result]) => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      opacity.value = withTiming(0, { duration: 250 })
      setTimeout(() => runOnJS(onDone)(result.reason, result.group), 250)
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [visible])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const dotStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${dotRotate.value}deg` }] }))
  const phraseStyle = useAnimatedStyle(() => ({ opacity: phraseOpacity.value }))

  if (!visible) return null

  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, styles.thinkingOverlay, overlayStyle]}>
      <Animated.View style={[styles.thinkingCard, cardStyle]}>
        <Animated.View style={[styles.thinkingDot, dotStyle]} />
        <Text style={styles.thinkingTitle}>Your Coach is Thinking</Text>
        <Animated.Text style={[styles.thinkingPhrase, phraseStyle]}>
          {THINKING_PHRASES[phraseIdx]}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getWorkoutHistory>>>([])
  const [step, setStep] = useState<Step>('focus')
  const [focus, setFocus] = useState<Focus | null>(null)
  const [selectedGroups, setSelectedGroups] = useState<Set<MuscleGroup>>(new Set())
  const [thinking, setThinking] = useState(false)

  // Animation values
  const headerOpacity = useSharedValue(0)
  const headerY = useSharedValue(20)
  const focusX = useSharedValue(0)
  const musclesX = useSharedValue(W)

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
        // Reset state on each focus
        setStep('focus')
        setFocus(null)
        setSelectedGroups(new Set())
        focusX.value = 0
        musclesX.value = W
        headerOpacity.value = withDelay(100, withTiming(1, { duration: 500 }))
        headerY.value = withDelay(100, withTiming(0, { duration: 400 }))
      }
      load()
      return () => { cancelled = true }
    }, [])
  )

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerY.value }],
  }))

  const focusStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: focusX.value }],
  }))

  const musclesStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: musclesX.value }],
  }))

  function selectFocus(f: Focus) {
    setFocus(f)
    setSelectedGroups(new Set(FOCUS_CONFIG[f].groups))
    // Slide focus out left, muscles in from right
    focusX.value = withTiming(-W, { duration: 320, easing: Easing.out(Easing.cubic) })
    musclesX.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) })
    setTimeout(() => setStep('muscles'), 0)
  }

  function goBack() {
    musclesX.value = withTiming(W, { duration: 280, easing: Easing.in(Easing.cubic) })
    focusX.value = withTiming(0, { duration: 280, easing: Easing.in(Easing.cubic) })
    setTimeout(() => setStep('focus'), 0)
  }

  function toggleGroup(g: MuscleGroup) {
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) { next.delete(g) } else { next.add(g) }
      return next
    })
  }

  async function handleLetsGo(groups?: MuscleGroup[]) {
    if (!profile) return
    const chosenGroups = groups ?? Array.from(selectedGroups)
    if (chosenGroups.length === 0) return
    const disliked = await getDislikedExercises()
    const exercises = getWorkoutExercises(chosenGroups, profile.level, disliked)
    setActiveWorkout({ exercises, muscleGroups: chosenGroups })
    router.push('/workout')
  }

  function handleChooseForMe() {
    setThinking(true)
  }

  async function onThinkingDone(reason: string, group: MuscleGroup) {
    setThinking(false)
    if (!profile) return
    const disliked = await getDislikedExercises()
    const exercises = getWorkoutExercises([group], profile.level, disliked)
    setActiveWorkout({
      exercises,
      muscleGroups: [group],
      chooseReason: reason,
    })
    router.push('/workout')
  }

  const hasSelection = selectedGroups.size > 0
  const greeting = getGreeting()

  if (!profile) return <View style={styles.loading} />

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <Animated.View style={[styles.header, headerStyle]}>
        <View>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.name}>{profile.name} 👋</Text>
        </View>
        <TouchableOpacity
          style={styles.dashBtn}
          onPress={() => router.push('/dashboard')}
          activeOpacity={0.8}
        >
          <Text style={styles.dashBtnText}>📊</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Step 1 — Focus */}
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.stepContainer, focusStyle]}>
        <ScrollView contentContainerStyle={styles.focusContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>What's the focus today?</Text>
          <View style={styles.focusCards}>
            {(Object.keys(FOCUS_CONFIG) as Focus[]).map((f, i) => {
              const cfg = FOCUS_CONFIG[f]
              return (
                <FocusCard
                  key={f}
                  icon={cfg.icon}
                  label={cfg.label}
                  sub={cfg.sub}
                  index={i}
                  onPress={() => selectFocus(f)}
                />
              )
            })}
          </View>
        </ScrollView>
      </Animated.View>

      {/* Step 2 — Muscles */}
      <Animated.View style={[StyleSheet.absoluteFillObject, styles.stepContainer, musclesStyle]}>
        <ScrollView contentContainerStyle={styles.musclesContent} showsVerticalScrollIndicator={false}>
          {/* Back button */}
          <TouchableOpacity style={styles.backRow} onPress={goBack} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>{focus ? FOCUS_CONFIG[focus].label : ''}</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Choose your muscles</Text>
          <Text style={styles.sectionSub}>Tap to toggle — select any combo</Text>

          <View style={styles.muscleGrid}>
            {(focus ? FOCUS_CONFIG[focus].groups : ([] as MuscleGroup[])).map((g) => {
              const active = selectedGroups.has(g)
              const color = MUSCLE_COLORS[g]
              return (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.muscleCard,
                    active && { borderColor: color, backgroundColor: color + '18' },
                  ]}
                  onPress={() => toggleGroup(g)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.muscleIcon}>{MUSCLE_GROUP_ICONS[g]}</Text>
                  <Text style={[styles.muscleLabel, active && { color }]}>
                    {MUSCLE_GROUP_LABELS[g]}
                  </Text>
                  {active && (
                    <View style={[styles.muscleBadge, { backgroundColor: color }]}>
                      <Text style={styles.muscleBadgeText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Selection count */}
          {hasSelection && (
            <Text style={styles.selectionCount}>
              {selectedGroups.size} muscle group{selectedGroups.size > 1 ? 's' : ''} selected
            </Text>
          )}

          {/* Spacer for bottom buttons */}
          <View style={{ height: 160 }} />
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottomArea}>
          <TouchableOpacity style={styles.chooseBtn} onPress={handleChooseForMe} activeOpacity={0.85}>
            <Text style={styles.chooseBtnIcon}>🎲</Text>
            <View>
              <Text style={styles.chooseBtnTitle}>Choose it for me</Text>
              <Text style={styles.chooseBtnSub}>AI coach picks your workout</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.letsGoBtn, !hasSelection && styles.letsGoBtnDisabled]}
            onPress={() => handleLetsGo()}
            disabled={!hasSelection}
            activeOpacity={0.9}
          >
            <Text style={styles.letsGoBtnText}>Let's Go →</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* AI Thinking overlay */}
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

// ─── Focus Card (with stagger animation) ─────────────────────────────────────

function FocusCard({
  icon, label, sub, index, onPress,
}: {
  icon: string; label: string; sub: string; index: number; onPress: () => void
}) {
  const opacity = useSharedValue(0)
  const y = useSharedValue(30)
  const scale = useSharedValue(1)

  useEffect(() => {
    opacity.value = withDelay(index * 100 + 200, withTiming(1, { duration: 400 }))
    y.value = withDelay(index * 100 + 200, withTiming(0, { duration: 400 }))
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }))

  function onPressIn() { scale.value = withTiming(0.97, { duration: 100 }) }
  function onPressOut() { scale.value = withSpring(1, { damping: 15 }) }

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        style={styles.focusCard}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <Text style={styles.focusCardIcon}>{icon}</Text>
        <View style={styles.focusCardText}>
          <Text style={styles.focusCardLabel}>{label}</Text>
          <Text style={styles.focusCardSub}>{sub}</Text>
        </View>
        <Text style={styles.focusCardArrow}>›</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  greeting: { fontSize: 14, color: C.textMuted, fontWeight: '500' },
  name:     { fontSize: 26, fontWeight: '800', color: C.text, marginTop: 2 },
  dashBtn: {
    width: 44,
    height: 44,
    backgroundColor: C.card,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  dashBtnText: { fontSize: 20 },

  stepContainer: {
    top: 100,
  },

  // Focus step
  focusContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: C.text,
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 14,
    color: C.textMuted,
    marginBottom: 20,
  },
  focusCards: { gap: 14 },
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
  focusCardIcon:  { fontSize: 34 },
  focusCardText:  { flex: 1 },
  focusCardLabel: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 3 },
  focusCardSub:   { fontSize: 13, color: C.textMuted },
  focusCardArrow: { fontSize: 24, color: C.purple, fontWeight: '300' },

  // Muscles step
  musclesContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  backArrow: { fontSize: 20, color: C.purple },
  backLabel: { fontSize: 16, fontWeight: '700', color: C.purple },

  muscleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  muscleCard: {
    width: (W - 60) / 2,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 18,
    gap: 6,
    position: 'relative',
  },
  muscleIcon:  { fontSize: 26 },
  muscleLabel: { fontSize: 16, fontWeight: '700', color: C.textDim },
  muscleBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muscleBadgeText: { fontSize: 11, fontWeight: '800', color: '#000' },

  selectionCount: {
    fontSize: 14,
    fontWeight: '600',
    color: C.purple,
    marginTop: 16,
    textAlign: 'center',
  },

  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    backgroundColor: C.bg,
    gap: 12,
    borderTopWidth: 1,
    borderColor: C.border,
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
  chooseBtnIcon:    { fontSize: 26 },
  chooseBtnTitle:   { fontSize: 15, fontWeight: '700', color: C.text },
  chooseBtnSub:     { fontSize: 12, color: C.textMuted, marginTop: 2 },
  letsGoBtn: {
    backgroundColor: C.purple,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  letsGoBtnDisabled: { opacity: 0.35 },
  letsGoBtnText:     { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },

  // Thinking overlay
  thinkingOverlay: {
    backgroundColor: 'rgba(13,17,23,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  thinkingCard: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    padding: 40,
    alignItems: 'center',
    width: W - 64,
  },
  thinkingDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    borderColor: C.purple,
    borderTopColor: 'transparent',
    marginBottom: 24,
  },
  thinkingTitle:  { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 14, textAlign: 'center' },
  thinkingPhrase: { fontSize: 14, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
})
