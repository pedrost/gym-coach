import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
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
import { C, MUSCLE_COLORS } from '../lib/theme'
import { Exercise } from '../lib/workoutData'
import { getActiveWorkout, setCompletedWorkout } from '../lib/workoutStore'
import { getReplacementExercise, getReducedExercise } from '../lib/workoutEngine'
import {
  getUserProfile,
  getDislikedExercises,
  addDislikedExercise,
  saveWorkoutRecord,
  saveWeightForExercise,
  getLastWeightForExercise,
  UserProfile,
  SetRecord,
  ExerciseRecord,
} from '../lib/storage'

const { width: W } = Dimensions.get('window')
const workout = getActiveWorkout()

// ─── Pulsing exercise illustration ───────────────────────────────────────────

function PulsingShape({ color }: { color: string }) {
  const scale = useSharedValue(1)
  const rotate = useSharedValue(0)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.1, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1, false
    )
    rotate.value = withRepeat(
      withTiming(360, { duration: 14000, easing: Easing.linear }),
      -1, false
    )
  }, [])

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }))
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <View style={shapes.container}>
      <Animated.View style={[shapes.outer, { backgroundColor: color + '14' }, outerStyle]}>
        <Animated.View style={[shapes.inner, { backgroundColor: color + '40' }, innerStyle]}>
          <View style={[shapes.core, { backgroundColor: color + 'BB' }]} />
        </Animated.View>
      </Animated.View>
    </View>
  )
}

const shapes = StyleSheet.create({
  container: { height: 200, justifyContent: 'center', alignItems: 'center' },
  outer:  { width: 150, height: 150, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  inner:  { width: 100, height: 100, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  core:   { width: 58,  height: 58,  borderRadius: 10 },
})

// ─── Rest timer ───────────────────────────────────────────────────────────────

function RestTimer({ seconds, onSkip, nextLabel }: {
  seconds: number; onSkip: () => void; nextLabel: string
}) {
  const bar = useSharedValue(1)
  useEffect(() => {
    bar.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear })
  }, [])
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }))

  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return (
    <View style={rest.container}>
      <Text style={rest.label}>Rest</Text>
      <Text style={rest.timer}>{m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${seconds}s`}</Text>
      <Text style={rest.next}>Up next: <Text style={rest.nextName}>{nextLabel}</Text></Text>
      <View style={rest.track}>
        <Animated.View style={[rest.fill, barStyle]} />
      </View>
      <TouchableOpacity style={rest.skipBtn} onPress={onSkip} activeOpacity={0.8}>
        <Text style={rest.skipText}>Skip Rest</Text>
      </TouchableOpacity>
    </View>
  )
}

const rest = StyleSheet.create({
  container: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    padding: 32,
    alignItems: 'center',
  },
  label:   { fontSize: 12, fontWeight: '700', color: C.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  timer:   { fontSize: 68, fontWeight: '800', color: C.purple, lineHeight: 76, marginBottom: 12 },
  next:    { fontSize: 15, color: C.textMuted, marginBottom: 24 },
  nextName:{ fontWeight: '700', color: C.text },
  track:   { height: 4, width: '100%', backgroundColor: C.border, borderRadius: 2, overflow: 'hidden', marginBottom: 24 },
  fill:    { height: '100%', backgroundColor: C.purple, borderRadius: 2 },
  skipBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 28 },
  skipText:{ fontSize: 14, fontWeight: '700', color: C.textMuted },
})

// ─── Weight Input ─────────────────────────────────────────────────────────────

function WeightInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(value > 0 ? String(value) : '')

  function increment(delta: number) {
    const next = Math.max(0, Math.round((value + delta) * 10) / 10)
    onChange(next)
    setText(next > 0 ? String(next) : '')
  }

  function onTextChange(t: string) {
    setText(t)
    const n = parseFloat(t)
    if (!isNaN(n) && n >= 0) onChange(n)
    else if (t === '' || t === '0') onChange(0)
  }

  return (
    <View style={wi.container}>
      <Text style={wi.label}>Weight used</Text>
      <View style={wi.row}>
        <TouchableOpacity style={wi.btn} onPress={() => increment(-2.5)} activeOpacity={0.7}>
          <Text style={wi.btnText}>−</Text>
        </TouchableOpacity>
        <View style={wi.inputWrap}>
          <TextInput
            style={wi.input}
            value={text}
            onChangeText={onTextChange}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={C.textMuted}
            selectTextOnFocus
          />
          <Text style={wi.unit}>kg</Text>
        </View>
        <TouchableOpacity style={wi.btn} onPress={() => increment(2.5)} activeOpacity={0.7}>
          <Text style={wi.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const wi = StyleSheet.create({
  container: {
    backgroundColor: C.cardAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginTop: 16,
  },
  label: { fontSize: 12, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  btn: {
    width: 48,
    height: 48,
    backgroundColor: C.card,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  btnText:   { fontSize: 22, fontWeight: '400', color: C.purple, lineHeight: 28 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  input: {
    fontSize: 28,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    minWidth: 80,
  },
  unit: { fontSize: 16, fontWeight: '600', color: C.textMuted },
})

// ─── Main Screen ──────────────────────────────────────────────────────────────

type Phase = 'exercise' | 'rest'
type SkipStep = 'why' | 'cantdo'

export default function WorkoutScreen() {
  const router = useRouter()

  const [exercises, setExercises] = useState<Exercise[]>(workout?.exercises ?? [])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [currentSetNum, setCurrentSetNum] = useState(1)
  const [currentWeight, setCurrentWeight] = useState(0)
  const [exerciseRecords, setExerciseRecords] = useState<ExerciseRecord[]>([])
  const [phase, setPhase] = useState<Phase>('exercise')
  const [restSeconds, setRestSeconds] = useState(0)
  const [restKey, setRestKey] = useState(0)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [startTime] = useState(Date.now())

  const [skipVisible, setSkipVisible] = useState(false)
  const [skipStep, setSkipStep] = useState<SkipStep>('why')
  const [toastMsg, setToastMsg] = useState('')

  const cardOpacity  = useSharedValue(1)
  const cardScale    = useSharedValue(1)
  const cardX        = useSharedValue(0)
  const skipSheetY   = useSharedValue(500)
  const toastOpacity = useSharedValue(0)
  const toastY       = useSharedValue(8)

  useEffect(() => {
    getUserProfile().then((p) => {
      if (!p) { router.replace('/'); return }
      setProfile(p)
    })
  }, [])

  // Load last-used weight when exercise changes
  useEffect(() => {
    const ex = exercises[currentIdx]
    if (!ex) return
    getLastWeightForExercise(ex.id).then(setCurrentWeight)
    setCurrentSetNum(1)
  }, [currentIdx])

  // Rest timer tick
  useEffect(() => {
    if (phase !== 'rest' || restSeconds <= 0) return
    const id = setTimeout(() => setRestSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(id)
  }, [phase, restSeconds])

  // When rest ends: advance
  useEffect(() => {
    if (phase === 'rest' && restSeconds === 0) {
      setPhase('exercise')
      animateCardIn()
    }
  }, [phase, restSeconds])

  function animateCardIn() {
    cardOpacity.value = 0; cardScale.value = 0.93; cardX.value = 24
    cardOpacity.value = withTiming(1, { duration: 320 })
    cardScale.value   = withSpring(1, { damping: 16 })
    cardX.value       = withSpring(0, { damping: 18 })
  }

  function animateCardOut(cb: () => void) {
    cardOpacity.value = withTiming(0, { duration: 200 })
    cardX.value = withTiming(-W * 0.35, { duration: 200 }, () => runOnJS(cb)())
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    toastOpacity.value = withTiming(1, { duration: 180 })
    toastY.value = withTiming(0, { duration: 180 })
    setTimeout(() => {
      toastOpacity.value = withTiming(0, { duration: 400 })
      toastY.value = withTiming(-8, { duration: 400 })
    }, 2500)
  }

  function getRestTime(): number {
    if (!profile) return 60
    return profile.level === 'advanced' ? 120 : profile.level === 'intermediate' ? 90 : 60
  }

  function startRest() {
    setRestSeconds(getRestTime())
    setRestKey((k) => k + 1)
    setPhase('rest')
  }

  function recordSet(ex: Exercise, setNum: number, weight: number) {
    const setRecord: SetRecord = {
      setNumber: setNum,
      repsCompleted: ex.reps,
      weightKg: weight,
    }
    setExerciseRecords((prev) => {
      const existing = prev.find((r) => r.exerciseId === ex.id)
      if (existing) {
        return prev.map((r) =>
          r.exerciseId === ex.id ? { ...r, sets: [...r.sets, setRecord] } : r
        )
      }
      return [...prev, {
        exerciseId: ex.id,
        exerciseName: ex.name,
        muscleGroup: ex.muscleGroup,
        sets: [setRecord],
        skipped: false,
      }]
    })
    // Save last-used weight
    if (weight > 0) saveWeightForExercise(ex.id, weight)
  }

  async function handleSetDone() {
    const ex = exercises[currentIdx]
    if (!ex || !profile) return

    recordSet(ex, currentSetNum, currentWeight)

    if (currentSetNum < ex.sets) {
      // More sets remaining — rest between sets
      setCurrentSetNum((n) => n + 1)
      animateCardOut(() => {
        startRest()
      })
    } else {
      // All sets done — move to next exercise
      if (currentIdx >= exercises.length - 1) {
        await finishWorkout([...exerciseRecords, {
          exerciseId: ex.id, exerciseName: ex.name,
          muscleGroup: ex.muscleGroup,
          sets: [], skipped: false,
        }])
        return
      }
      animateCardOut(() => {
        setCurrentIdx((i) => i + 1)
        startRest()
      })
    }
  }

  function handleSkipRest() {
    setPhase('exercise')
    animateCardIn()
  }

  function openSkipSheet() {
    setSkipStep('why')
    setSkipVisible(true)
    skipSheetY.value = withSpring(0, { damping: 20, stiffness: 200 })
  }

  function closeSkipSheet() {
    skipSheetY.value = withTiming(500, { duration: 260 })
    setTimeout(() => setSkipVisible(false), 260)
  }

  async function handleDontLike() {
    const ex = exercises[currentIdx]
    if (!ex || !profile) return
    await addDislikedExercise(ex.id)
    const disliked = await getDislikedExercises()
    const replacement = getReplacementExercise(ex, exercises.map((e) => e.id), disliked, profile.level)
    closeSkipSheet()
    if (replacement) {
      animateCardOut(() => {
        setExercises((prev) => { const n = [...prev]; n[currentIdx] = replacement; return n })
        animateCardIn()
      })
      showToast("Got it! I'll avoid this one next time.")
    } else {
      skipExercise()
    }
  }

  async function handleLowerWeight() {
    const ex = exercises[currentIdx]
    if (!ex) return
    const reduced = getReducedExercise(ex)
    setExercises((prev) => { const n = [...prev]; n[currentIdx] = reduced; return n })
    closeSkipSheet()
    animateCardIn()
    showToast(`Adjusted to ${reduced.sets}×${reduced.reps} — you've got this.`)
  }

  async function handleSimilarExercise() {
    const ex = exercises[currentIdx]
    if (!ex || !profile) return
    const disliked = await getDislikedExercises()
    const replacement = getReplacementExercise(ex, exercises.map((e) => e.id), disliked, profile.level)
    closeSkipSheet()
    if (replacement) {
      animateCardOut(() => {
        setExercises((prev) => { const n = [...prev]; n[currentIdx] = replacement; return n })
        animateCardIn()
      })
    } else {
      showToast('No alternative found — you can do it! 💪')
    }
  }

  function skipExercise() {
    const ex = exercises[currentIdx]
    setExerciseRecords((prev) => {
      const exists = prev.find((r) => r.exerciseId === ex?.id)
      if (exists || !ex) return prev
      return [...prev, { exerciseId: ex.id, exerciseName: ex.name, muscleGroup: ex.muscleGroup, sets: [], skipped: true }]
    })
    closeSkipSheet()
    if (currentIdx >= exercises.length - 1) {
      finishWorkout(exerciseRecords)
      return
    }
    animateCardOut(() => {
      setCurrentIdx((i) => i + 1)
      animateCardIn()
    })
  }

  async function finishWorkout(finalRecords: ExerciseRecord[]) {
    const doneRecords = finalRecords.filter((r) => !r.skipped && r.sets.length > 0)
    const totalSets = doneRecords.reduce((s, r) => s + r.sets.length, 0)
    const totalVolumeKg = doneRecords.reduce(
      (s, r) => s + r.sets.reduce((ss, set) => ss + set.weightKg * set.repsCompleted, 0), 0
    )
    const calories = Math.round(totalSets * 5.5)
    const durationMinutes = Math.round((Date.now() - startTime) / 60000)

    const record = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      muscleGroups: workout?.muscleGroups ?? [],
      exercises: finalRecords,
      durationMinutes,
      totalSets,
      totalVolumeKg: Math.round(totalVolumeKg),
      estimatedCalories: calories,
    }
    await saveWorkoutRecord(record)

    setCompletedWorkout({
      userName: profile?.name ?? '',
      exercisesCompleted: doneRecords.length,
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
  const skipStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: skipSheetY.value }],
  }))
  const toastStyle = useAnimatedStyle(() => ({
    opacity: toastOpacity.value,
    transform: [{ translateY: toastY.value }],
  }))

  const ex = exercises[currentIdx]
  if (!ex) return <View style={s.safe} />

  const groupColor = MUSCLE_COLORS[ex.muscleGroup] ?? C.purple
  const nextEx = exercises[currentIdx + 1]
  const progressPct = (currentIdx / exercises.length) * 100
  const totalMinutes = exercises.length * 7

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.replace('/')} activeOpacity={0.7}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>
            {workout?.muscleGroups.map((g) => g[0].toUpperCase() + g.slice(1)).join(' · ')}
          </Text>
          <Text style={s.headerSub}>~{totalMinutes} min</Text>
        </View>
        <View style={s.counterBadge}>
          <Text style={s.counterText}>{currentIdx + 1}/{exercises.length}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${progressPct}%`, backgroundColor: groupColor }]} />
      </View>

      {/* Set dots */}
      {phase === 'exercise' && (
        <View style={s.setDots}>
          {Array.from({ length: ex.sets }).map((_, i) => (
            <View
              key={i}
              style={[s.setDot, i < currentSetNum - 1
                ? { backgroundColor: groupColor }
                : i === currentSetNum - 1
                  ? { backgroundColor: groupColor, opacity: 1, transform: [{ scale: 1.2 }] }
                  : { backgroundColor: C.border }
              ]}
            />
          ))}
          <Text style={s.setLabel}>Set {currentSetNum} of {ex.sets}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {phase === 'rest' ? (
            <RestTimer
              key={restKey}
              seconds={restSeconds}
              onSkip={handleSkipRest}
              nextLabel={
                currentSetNum <= ex.sets
                  ? `${ex.name} — Set ${currentSetNum}`
                  : (nextEx?.name ?? 'Last exercise done!')
              }
            />
          ) : (
            <Animated.View style={[s.card, cardStyle]}>
              <PulsingShape color={groupColor} />
              <View style={s.exerciseInfo}>
                <View style={[s.badge, { backgroundColor: groupColor + '22' }]}>
                  <Text style={[s.badgeText, { color: groupColor }]}>
                    {ex.muscleGroup.toUpperCase()}
                  </Text>
                </View>
                <Text style={s.exerciseName}>{ex.name}</Text>
                <Text style={[s.setsReps, { color: groupColor }]}>
                  {ex.sets} × {ex.repsLabel ?? ex.reps}
                </Text>
                <Text style={s.desc}>{ex.description}</Text>
              </View>
              <WeightInput value={currentWeight} onChange={setCurrentWeight} />
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Actions */}
      {phase === 'exercise' && (
        <View style={s.actions}>
          <TouchableOpacity style={s.skipBtn} onPress={openSkipSheet} activeOpacity={0.8}>
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.doneBtn, { backgroundColor: groupColor }]} onPress={handleSetDone} activeOpacity={0.9}>
            <Text style={s.doneText}>
              {currentSetNum < ex.sets ? `✓ Set ${currentSetNum} Done` : '✓ Exercise Done'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Toast */}
      <Animated.View style={[s.toast, toastStyle]} pointerEvents="none">
        <Text style={s.toastText}>{toastMsg}</Text>
      </Animated.View>

      {/* Skip Sheet */}
      {skipVisible && (
        <Modal transparent animationType="none" visible={skipVisible}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeSkipSheet} />
          <Animated.View style={[s.sheet, skipStyle]}>
            <View style={s.sheetHandle} />
            {skipStep === 'why' ? (
              <>
                <Text style={s.sheetTitle}>Why are you skipping?</Text>
                <TouchableOpacity style={s.sheetOpt} onPress={() => setSkipStep('cantdo')} activeOpacity={0.8}>
                  <Text style={s.sheetOptIcon}>🚫</Text>
                  <View>
                    <Text style={s.sheetOptTitle}>Can't do this</Text>
                    <Text style={s.sheetOptSub}>Equipment or mobility issue</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetOpt} onPress={handleDontLike} activeOpacity={0.8}>
                  <Text style={s.sheetOptIcon}>👎</Text>
                  <View>
                    <Text style={s.sheetOptTitle}>Don't like it</Text>
                    <Text style={s.sheetOptSub}>Remove from future sessions</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.sheetTitle}>What would you prefer?</Text>
                <TouchableOpacity style={s.sheetOpt} onPress={handleLowerWeight} activeOpacity={0.8}>
                  <Text style={s.sheetOptIcon}>⬇️</Text>
                  <View>
                    <Text style={s.sheetOptTitle}>Lower the weight</Text>
                    <Text style={s.sheetOptSub}>Reduce sets & reps</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={s.sheetOpt} onPress={handleSimilarExercise} activeOpacity={0.8}>
                  <Text style={s.sheetOptIcon}>🔄</Text>
                  <View>
                    <Text style={s.sheetOptTitle}>Similar exercise</Text>
                    <Text style={s.sheetOptSub}>Swap for same muscle group</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  closeBtn: {
    width: 36, height: 36, backgroundColor: C.card, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  closeBtnText: { fontSize: 14, color: C.textMuted, fontWeight: '700' },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle:  { fontSize: 15, fontWeight: '800', color: C.text },
  headerSub:    { fontSize: 12, color: C.textMuted, marginTop: 1 },
  counterBadge: { backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.border },
  counterText:  { fontSize: 13, fontWeight: '700', color: C.purple },

  progressTrack: { height: 3, backgroundColor: C.border, marginHorizontal: 20, borderRadius: 2, overflow: 'hidden', marginBottom: 10 },
  progressFill:  { height: '100%', borderRadius: 2 },

  setDots: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 8,
  },
  setDot:   { width: 8, height: 8, borderRadius: 4, opacity: 0.5 },
  setLabel: { fontSize: 12, fontWeight: '600', color: C.textMuted, marginLeft: 6 },

  scroll:        { flex: 1, backgroundColor: C.bg },
  scrollContent: { padding: 20, paddingBottom: 120 },

  card: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  exerciseInfo: { padding: 22, paddingTop: 14 },
  badge:        { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 10 },
  badgeText:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  exerciseName: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 6, lineHeight: 32 },
  setsReps:     { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  desc:         { fontSize: 14, color: C.textDim, lineHeight: 21 },

  actions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 36,
    backgroundColor: C.bg, borderTopWidth: 1, borderColor: C.border, zIndex: 10,
  },
  skipBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  skipText: { fontSize: 15, fontWeight: '700', color: C.textMuted },
  doneBtn:  { flex: 2.2, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  doneText: { fontSize: 15, fontWeight: '800', color: '#000' },

  toast: {
    position: 'absolute', top: 96, left: 24, right: 24,
    backgroundColor: C.cardAlt, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: C.text },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 48, borderWidth: 1, borderColor: C.border, borderBottomWidth: 0, zIndex: 50,
  },
  sheetHandle: { width: 38, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  sheetTitle:  { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 16 },
  sheetOpt:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderTopWidth: 1, borderColor: C.border },
  sheetOptIcon:  { fontSize: 26 },
  sheetOptTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  sheetOptSub:   { fontSize: 13, color: C.textMuted },
})
