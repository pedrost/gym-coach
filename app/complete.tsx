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
import { getCompletedWorkout, clearCompletedWorkout, clearActiveWorkout } from '../lib/workoutStore'

const C = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  accent: '#E8FF47',
  text: '#FFFFFF',
  muted: '#666666',
  border: '#2A2A2A',
}

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  const scale = useSharedValue(0.8)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(400, withSpring(1, { damping: 14 }))
    opacity.value = withDelay(400, withTiming(1, { duration: 300 }))
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[styles.statCard, style]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  )
}

export default function CompleteScreen() {
  const router = useRouter()
  const data = getCompletedWorkout()

  const checkScale = useSharedValue(0)
  const checkOpacity = useSharedValue(0)
  const titleOpacity = useSharedValue(0)
  const titleY = useSharedValue(20)
  const ringScale = useSharedValue(0.3)
  const ringOpacity = useSharedValue(1)

  useEffect(() => {
    // Ring burst
    ringScale.value = withTiming(2.2, { duration: 700 })
    ringOpacity.value = withSequence(
      withTiming(0.5, { duration: 200 }),
      withDelay(300, withTiming(0, { duration: 400 }))
    )

    // Checkmark
    checkScale.value = withDelay(150, withSpring(1, { damping: 12, stiffness: 180 }))
    checkOpacity.value = withDelay(150, withTiming(1, { duration: 200 }))

    // Title
    titleOpacity.value = withDelay(400, withTiming(1, { duration: 400 }))
    titleY.value = withDelay(400, withTiming(0, { duration: 400 }))
  }, [])

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }))

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }))

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }))

  function handleBackHome() {
    clearCompletedWorkout()
    clearActiveWorkout()
    router.replace('/')
  }

  function handleLogAnother() {
    clearCompletedWorkout()
    clearActiveWorkout()
    router.replace('/')
  }

  const userName = data?.userName ?? ''
  const exercisesDone = data?.exercisesCompleted ?? 0
  const totalSets = data?.totalSets ?? 0
  const calories = data?.estimatedCalories ?? 0
  const groups = data?.muscleGroups ?? []

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Celebration graphic */}
        <View style={styles.celebrationArea}>
          <View style={styles.checkWrapper}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <Animated.View style={[styles.checkCircle, checkStyle]}>
              <Text style={styles.checkmark}>✓</Text>
            </Animated.View>
          </View>
        </View>

        {/* Title */}
        <Animated.View style={[styles.titleArea, titleStyle]}>
          <Text style={styles.title}>
            Great work{userName ? `, ${userName}` : ''}! 🎉
          </Text>
          {groups.length > 0 && (
            <Text style={styles.subtitle}>
              {groups.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(' + ')} session complete
            </Text>
          )}
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard icon="🏋️" value={String(exercisesDone)} label="Exercises" />
          <StatCard icon="🔁" value={String(totalSets)} label="Total Sets" />
          <StatCard icon="🔥" value={`~${calories}`} label="Calories" />
        </View>

        {/* Motivational message */}
        <Animated.View style={[styles.motivCard, titleStyle]}>
          <Text style={styles.motivText}>
            {exercisesDone >= 4
              ? "You showed up and crushed it. That's what separates the committed from everyone else. 💪"
              : exercisesDone >= 2
              ? "Every session counts. You're building momentum — keep it going!"
              : "Getting started is the hardest part. You did it — see you next time!"}
          </Text>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[styles.buttons, titleStyle]}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleLogAnother} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>+ Log Another</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleBackHome} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 60 },

  celebrationArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  checkWrapper: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: C.accent,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    fontSize: 48,
    fontWeight: '900',
    color: '#000',
    lineHeight: 56,
  },

  titleArea: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: C.muted,
    textAlign: 'center',
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    alignItems: 'center',
  },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 26, fontWeight: '800', color: C.accent, marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: C.muted, textAlign: 'center' },

  motivCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
    marginBottom: 32,
  },
  motivText: {
    fontSize: 15,
    color: '#AAA',
    lineHeight: 22,
    textAlign: 'center',
  },

  buttons: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
  },
  secondaryBtn: {
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },
})
