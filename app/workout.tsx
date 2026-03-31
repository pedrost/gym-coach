import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Exercise } from '../lib/workoutData'
import { getActiveWorkout, setCompletedWorkout } from '../lib/workoutStore'
import {
  getReplacementExercise,
  getReducedExercise,
  estimateCalories,
} from '../lib/workoutEngine'
import {
  getUserProfile,
  getDislikedExercises,
  addDislikedExercise,
  saveWorkoutRecord,
  UserProfile,
} from '../lib/storage'

const { width: W } = Dimensions.get('window')

const C = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  accent: '#E8FF47',
  text: '#FFFFFF',
  muted: '#666666',
  border: '#2A2A2A',
  danger: '#FF5252',
}

type SkipStep = 'why' | 'cantdo'
type Phase = 'exercise' | 'rest'

function usePulse() {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.7)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.12, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false
    )
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.6, { duration: 900 })
      ),
      -1,
      false
    )
  }, [])

  return useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
}

function PulsingShape({ color }: { color: string }) {
  const pulse = usePulse()
  const rotate = useSharedValue(0)

  useEffect(() => {
    rotate.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    )
  }, [])

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }))

  return (
    <View style={styles.shapeContainer}>
      <Animated.View style={[styles.shapeOuter, { backgroundColor: color + '18' }, rotateStyle]}>
        <Animated.View style={[styles.shapeInner, { backgroundColor: color + '50' }, pulse]}>
          <View style={[styles.shapeCore, { backgroundColor: color + 'CC' }]} />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

function RestTimer({
  seconds,
  onSkip,
  exerciseName,
}: {
  seconds: number
  onSkip: () => void
  exerciseName: string
}) {
  const progress = useSharedValue(1)

  useEffect(() => {
    progress.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear })
  }, [])

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <View style={styles.restContainer}>
      <Text style={styles.restLabel}>Rest time</Text>
      <Text style={styles.restTimer}>
        {mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${seconds}s`}
      </Text>
      <Text style={styles.restNext}>
        Up next: <Text style={styles.restNextName}>{exerciseName}</Text>
      </Text>
      <View style={styles.restTrack}>
        <Animated.View style={[styles.restFill, barStyle]} />
      </View>
      <TouchableOpacity style={styles.skipRestBtn} onPress={onSkip} activeOpacity={0.8}>
        <Text style={styles.skipRestBtnText}>Skip Rest</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function WorkoutScreen() {
  const router = useRouter()
  const workout = getActiveWorkout()

  const [exercises, setExercises] = useState<Exercise[]>(workout?.exercises ?? [])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>('exercise')
  const [restSeconds, setRestSeconds] = useState(0)
  const [restKey, setRestKey] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [skipVisible, setSkipVisible] = useState(false)
  const [skipStep, setSkipStep] = useState<SkipStep>('why')
  const [reducedExercise, setReducedExercise] = useState<Exercise | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  const cardOpacity = useSharedValue(1)
  const cardScale = useSharedValue(1)
  const cardX = useSharedValue(0)
  const skipSheetY = useSharedValue(400)
  const toastOpacity = useSharedValue(0)
  const toastY = useSharedValue(20)

  useEffect(() => {
    getUserProfile().then((p) => {
      if (!p) {
        router.replace('/')
        return
      }
      setProfile(p)
    })
  }, [])

  // Rest timer — one tick per render cycle
  useEffect(() => {
    if (phase !== 'rest' || restSeconds <= 0) return
    const id = setTimeout(() => setRestSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [phase, restSeconds])

  // Advance when rest hits zero
  useEffect(() => {
    if (phase === 'rest' && restSeconds === 0) {
      setPhase('exercise')
      setCurrentIdx((i) => i + 1)
      animateCardIn()
    }
  }, [phase, restSeconds])

  function animateCardIn() {
    cardOpacity.value = 0
    cardScale.value = 0.92
    cardX.value = 30
    cardOpacity.value = withTiming(1, { duration: 350 })
    cardScale.value = withSpring(1, { damping: 16, stiffness: 180 })
    cardX.value = withSpring(0, { damping: 18, stiffness: 200 })
  }

  function animateCardOut(callback: () => void) {
    cardOpacity.value = withTiming(0, { duration: 220 })
    cardX.value = withTiming(-W * 0.4, { duration: 220 }, () => {
      runOnJS(callback)()
    })
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    toastOpacity.value = withTiming(1, { duration: 200 })
    toastY.value = withTiming(0, { duration: 200 })
    setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 400 })
      toastY.value = withTiming(-10, { duration: 400 })
    }, 2400)
  }

  const currentExercise = exercises[currentIdx]
  const nextExercise = exercises[currentIdx + 1]
  const isLastExercise = currentIdx >= exercises.length - 1

  async function handleDone() {
    if (!profile || !currentExercise) return

    const newCompleted = [...completedIds, currentExercise.id]
    setCompletedIds(newCompleted)

    if (isLastExercise) {
      finishWorkout(newCompleted)
      return
    }

    const restTime = profile.level === 'advanced' ? 120 : profile.level === 'intermediate' ? 90 : 60

    animateCardOut(() => {
      setPhase('rest')
      setRestSeconds(restTime)
      setRestKey((k) => k + 1)
    })
  }

  function handleSkipRest() {
    setPhase('exercise')
    setCurrentIdx((i) => i + 1)
    animateCardIn()
  }

  function openSkipSheet() {
    setSkipStep('why')
    setReducedExercise(null)
    setSkipVisible(true)
    skipSheetY.value = withSpring(0, { damping: 20, stiffness: 200 })
  }

  function closeSkipSheet() {
    skipSheetY.value = withTiming(400, { duration: 260 })
    setTimeout(() => setSkipVisible(false), 260)
  }

  async function handleCantDo() {
    setSkipStep('cantdo')
  }

  async function handleDontLike() {
    if (!currentExercise || !profile) return

    await addDislikedExercise(currentExercise.id)
    const disliked = await getDislikedExercises()
    const usedIds = exercises.map((e) => e.id)
    const replacement = getReplacementExercise(currentExercise, usedIds, disliked, profile.level)

    closeSkipSheet()

    if (replacement) {
      animateCardOut(() => {
        setExercises((prev) => {
          const next = [...prev]
          next[currentIdx] = replacement
          return next
        })
        animateCardIn()
      })
      showToast("Got it! I'll avoid this one next time.")
    } else {
      skipCurrentExercise()
      showToast('Exercise removed.')
    }
  }

  async function handleLowerWeight() {
    if (!currentExercise) return
    const reduced = getReducedExercise(currentExercise)
    setReducedExercise(reduced)
    setExercises((prev) => {
      const next = [...prev]
      next[currentIdx] = reduced
      return next
    })
    closeSkipSheet()
    animateCardIn()
    showToast('Adjusted — take it at your own pace.')
  }

  async function handleSimilarExercise() {
    if (!currentExercise || !profile) return
    const disliked = await getDislikedExercises()
    const usedIds = exercises.map((e) => e.id)
    const replacement = getReplacementExercise(currentExercise, usedIds, disliked, profile.level)

    closeSkipSheet()

    if (replacement) {
      animateCardOut(() => {
        setExercises((prev) => {
          const next = [...prev]
          next[currentIdx] = replacement
          return next
        })
        animateCardIn()
      })
    } else {
      showToast('No alternative found — giving it a go!')
    }
  }

  function skipCurrentExercise() {
    closeSkipSheet()
    if (isLastExercise) {
      finishWorkout(completedIds)
      return
    }
    animateCardOut(() => {
      setCurrentIdx((i) => i + 1)
      animateCardIn()
    })
  }

  async function finishWorkout(doneIds: string[]) {
    const doneExercises = exercises.filter((e) => doneIds.includes(e.id))
    const totalSets = doneExercises.reduce((s, e) => s + e.sets, 0)
    const calories = estimateCalories(doneExercises)

    const record = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      muscleGroups: workout?.muscleGroups ?? [],
      exercisesCompleted: doneExercises.length,
      totalSets,
      estimatedCalories: calories,
    }
    await saveWorkoutRecord(record)

    setCompletedWorkout({
      userName: profile?.name ?? '',
      exercisesCompleted: doneExercises.length,
      totalSets,
      estimatedCalories: calories,
      muscleGroups: workout?.muscleGroups ?? [],
    })

    router.replace('/complete')
  }

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ scale: cardScale.value }, { translateX: cardX.value }],
  }))

  const skipSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: skipSheetY.value }],
  }))

  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastY.value }],
  }))

  if (!currentExercise) {
    return <View style={styles.safe} />
  }

  const groupLabel = currentExercise.muscleGroup.charAt(0).toUpperCase() + currentExercise.muscleGroup.slice(1)
  const totalMinutes = exercises.length * 7

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>
            {workout?.muscleGroups.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(' · ')}
          </Text>
          <Text style={styles.headerSub}>~{totalMinutes} min</Text>
        </View>
        <View style={styles.headerCount}>
          <Text style={styles.headerCountText}>
            {currentIdx + 1}/{exercises.length}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIdx) / exercises.length) * 100}%` }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {phase === 'rest' ? (
          <RestTimer
            key={restKey}
            seconds={restSeconds}
            onSkip={handleSkipRest}
            exerciseName={nextExercise?.name ?? 'Next Exercise'}
          />
        ) : (
          <Animated.View style={[styles.card, cardStyle]}>
            {/* Exercise illustration */}
            <PulsingShape color={currentExercise.color} />

            {/* Exercise info */}
            <View style={styles.exerciseInfo}>
              <View style={styles.exerciseBadge}>
                <Text style={styles.exerciseBadgeText}>{groupLabel}</Text>
              </View>
              <Text style={styles.exerciseName}>{currentExercise.name}</Text>
              <Text style={styles.exerciseSetsReps}>
                {currentExercise.sets} × {currentExercise.repsLabel ?? currentExercise.reps}
              </Text>
              <Text style={styles.exerciseDesc}>{currentExercise.description}</Text>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Action buttons */}
      {phase === 'exercise' && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.skipBtn} onPress={openSkipSheet} activeOpacity={0.8}>
            <Text style={styles.skipBtnText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.9}>
            <Text style={styles.doneBtnText}>✓ Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toast */}
      <Animated.View style={[styles.toast, toastStyle]} pointerEvents="none">
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>

      {/* Skip bottom sheet */}
      {skipVisible && (
        <Modal transparent animationType="none" visible={skipVisible}>
          <TouchableOpacity
            style={styles.overlay}
            activeOpacity={1}
            onPress={closeSkipSheet}
          />
          <Animated.View style={[styles.sheet, skipSheetStyle]}>
            {skipStep === 'why' && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>Why are you skipping?</Text>
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleCantDo}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetOptionIcon}>🚫</Text>
                  <View>
                    <Text style={styles.sheetOptionTitle}>Can't do this</Text>
                    <Text style={styles.sheetOptionSub}>Injury, equipment or ability issue</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleDontLike}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetOptionIcon}>👎</Text>
                  <View>
                    <Text style={styles.sheetOptionTitle}>Don't like it</Text>
                    <Text style={styles.sheetOptionSub}>We'll remove it from your list</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            {skipStep === 'cantdo' && (
              <>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>No worries. What would{'\n'}you prefer?</Text>
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleLowerWeight}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetOptionIcon}>⬇️</Text>
                  <View>
                    <Text style={styles.sheetOptionTitle}>Lower the weight</Text>
                    <Text style={styles.sheetOptionSub}>Reduce sets & reps to match your level</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.sheetOption}
                  onPress={handleSimilarExercise}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sheetOptionIcon}>🔄</Text>
                  <View>
                    <Text style={styles.sheetOptionTitle}>Similar exercise</Text>
                    <Text style={styles.sheetOptionSub}>Swap for another from the same group</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    backgroundColor: C.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtnText: { color: C.muted, fontSize: 16, fontWeight: '700' },
  headerMeta: { flex: 1, paddingHorizontal: 14 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  headerCount: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerCountText: { fontSize: 14, fontWeight: '700', color: C.accent },

  progressTrack: {
    height: 3,
    backgroundColor: C.border,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },

  card: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  shapeContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  shapeOuter: {
    width: 160,
    height: 160,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shapeInner: {
    width: 110,
    height: 110,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shapeCore: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },

  exerciseInfo: {
    padding: 24,
    paddingTop: 16,
  },
  exerciseBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  exerciseBadgeText: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.8 },
  exerciseName: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text,
    marginBottom: 8,
    lineHeight: 34,
  },
  exerciseSetsReps: {
    fontSize: 22,
    fontWeight: '700',
    color: C.accent,
    marginBottom: 16,
  },
  exerciseDesc: {
    fontSize: 15,
    color: '#999',
    lineHeight: 22,
  },

  actions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingBottom: 36,
    backgroundColor: C.bg,
  },
  skipBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  skipBtnText: { fontSize: 16, fontWeight: '700', color: C.muted },
  doneBtn: {
    flex: 2,
    backgroundColor: C.accent,
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  restContainer: {
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  restLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  restTimer: {
    fontSize: 72,
    fontWeight: '800',
    color: C.accent,
    lineHeight: 80,
    marginBottom: 16,
  },
  restNext: { fontSize: 16, color: C.muted, marginBottom: 24 },
  restNextName: { fontWeight: '700', color: C.text },
  restTrack: {
    height: 4,
    width: '100%',
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 28,
  },
  restFill: { height: '100%', backgroundColor: C.accent, borderRadius: 2 },
  skipRestBtn: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  skipRestBtnText: { fontSize: 15, fontWeight: '700', color: C.muted },

  toast: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  toastText: { fontSize: 14, fontWeight: '600', color: C.text },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#161616',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 48,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginBottom: 20,
    lineHeight: 28,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 18,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  sheetOptionIcon: { fontSize: 28 },
  sheetOptionTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 2 },
  sheetOptionSub: { fontSize: 13, color: C.muted },
})
