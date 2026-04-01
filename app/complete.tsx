import React, { useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C } from '../lib/theme'
import { getCompletedWorkout, clearCompletedWorkout, clearActiveWorkout } from '../lib/workoutStore'

export default function CompleteScreen() {
  const router = useRouter()
  const data   = getCompletedWorkout()

  const ringScale    = useSharedValue(0.3)
  const ringOpacity  = useSharedValue(0.8)
  const checkScale   = useSharedValue(0)
  const checkOpacity = useSharedValue(0)
  const titleOpacity = useSharedValue(0)
  const titleY       = useSharedValue(18)

  useEffect(() => {
    ringScale.value   = withTiming(2.4, { duration: 750 })
    ringOpacity.value = withSequence(withTiming(0.4, { duration: 200 }), withDelay(300, withTiming(0, { duration: 450 })))
    checkScale.value  = withDelay(150, withSpring(1, { damping: 11, stiffness: 160 }))
    checkOpacity.value= withDelay(150, withTiming(1, { duration: 200 }))
    titleOpacity.value= withDelay(450, withTiming(1, { duration: 400 }))
    titleY.value      = withDelay(450, withTiming(0, { duration: 400 }))
  }, [])

  const ringStyle  = useAnimatedStyle(() => ({ transform: [{ scale: ringScale.value }], opacity: ringOpacity.value }))
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }], opacity: checkOpacity.value }))
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value, transform: [{ translateY: titleY.value }] }))

  function handleHome() {
    clearCompletedWorkout(); clearActiveWorkout()
    router.replace('/')
  }
  function handleDashboard() {
    clearCompletedWorkout(); clearActiveWorkout()
    router.replace('/dashboard')
  }

  const name      = data?.userName ?? ''
  const exercises = data?.exercisesCompleted ?? 0
  const sets      = data?.totalSets ?? 0
  const calories  = data?.estimatedCalories ?? 0

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Celebration */}
        <View style={s.celebArea}>
          <View style={s.checkWrap}>
            <Animated.View style={[s.ring, ringStyle]} />
            <Animated.View style={[s.checkCircle, checkStyle]}>
              <Text style={s.checkmark}>✓</Text>
            </Animated.View>
          </View>
        </View>

        {/* Title */}
        <Animated.View style={[s.titleArea, titleStyle]}>
          <Text style={s.title}>Great work{name ? `, ${name}` : ''}! 🎉</Text>
          {(data?.muscleGroups?.length ?? 0) > 0 && (
            <Text style={s.subtitle}>
              {data!.muscleGroups.map((g) => g[0].toUpperCase() + g.slice(1)).join(' + ')} complete
            </Text>
          )}
        </Animated.View>

        {/* Stats */}
        <Animated.View style={[s.statsRow, titleStyle]}>
          <StatPill icon="🏋️" value={String(exercises)} label="Exercises" />
          <StatPill icon="🔁" value={String(sets)} label="Sets" />
          <StatPill icon="🔥" value={`~${calories}`} label="kcal" />
        </Animated.View>

        {/* Motivational */}
        <Animated.View style={[s.motivCard, titleStyle]}>
          <Text style={s.motivText}>
            {exercises >= 4
              ? 'You showed up and delivered. That\'s what separates the consistent from everyone else. 💪'
              : exercises >= 2
              ? 'Every session builds momentum. You\'re on the right track — keep going!'
              : 'The hardest part is starting. You did it — see you next time!'}
          </Text>
        </Animated.View>

        {/* Actions */}
        <Animated.View style={[s.buttons, titleStyle]}>
          <TouchableOpacity style={s.dashBtn} onPress={handleDashboard} activeOpacity={0.85}>
            <Text style={s.dashBtnText}>📊 View Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleHome} activeOpacity={0.85}>
            <Text style={s.secondaryBtnText}>+ Train Again</Text>
          </TouchableOpacity>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  )
}

function StatPill({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={s.pill}>
      <Text style={s.pillIcon}>{icon}</Text>
      <Text style={s.pillValue}>{value}</Text>
      <Text style={s.pillLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 60 },

  celebArea: { alignItems: 'center', marginBottom: 32 },
  checkWrap: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  ring: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    borderWidth: 3, borderColor: C.purple,
  },
  checkCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: C.purple,
    justifyContent: 'center', alignItems: 'center',
  },
  checkmark: { fontSize: 48, fontWeight: '900', color: '#FFF', lineHeight: 56 },

  titleArea:  { alignItems: 'center', marginBottom: 28 },
  title:      { fontSize: 28, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 6, lineHeight: 36 },
  subtitle:   { fontSize: 15, color: C.textMuted, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pill: {
    flex: 1, backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    padding: 14, alignItems: 'center',
  },
  pillIcon:  { fontSize: 20, marginBottom: 6 },
  pillValue: { fontSize: 22, fontWeight: '800', color: C.purple, marginBottom: 2 },
  pillLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted },

  motivCard: {
    backgroundColor: C.card, borderRadius: 20, borderWidth: 1,
    borderColor: C.border, padding: 20, marginBottom: 28,
  },
  motivText: { fontSize: 14, color: C.textDim, lineHeight: 22, textAlign: 'center' },

  buttons:       { gap: 12 },
  dashBtn: {
    backgroundColor: C.purple, borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
  },
  dashBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  secondaryBtn: {
    backgroundColor: C.card, borderRadius: 18, paddingVertical: 18,
    alignItems: 'center', borderWidth: 1, borderColor: C.border,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '700', color: C.text },
})
