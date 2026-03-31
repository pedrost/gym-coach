import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from 'react-native-reanimated'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getUserProfile, getDislikedExercises, UserProfile } from '../lib/storage'
import {
  getWorkoutExercises,
  pickSuggestedGroup,
  estimateMinutes,
} from '../lib/workoutEngine'
import { setActiveWorkout } from '../lib/workoutStore'
import { MuscleGroup, MUSCLE_GROUP_LABELS, MUSCLE_GROUP_ICONS } from '../lib/workoutData'

const { width: W } = Dimensions.get('window')

const C = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  accent: '#E8FF47',
  text: '#FFFFFF',
  muted: '#666666',
  border: '#2A2A2A',
}

type Focus = 'upper' | 'lower' | 'full' | null

const FOCUS_MUSCLE_MAP: Record<Exclude<Focus, null>, MuscleGroup[]> = {
  upper: ['back', 'chest', 'arms', 'shoulders'],
  lower: ['legs', 'core'],
  full: ['back', 'chest', 'arms', 'legs', 'shoulders', 'core'],
}

const ALL_MUSCLE_GROUPS: MuscleGroup[] = ['back', 'chest', 'arms', 'legs', 'shoulders', 'core']

export default function HomeScreen() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [focus, setFocus] = useState<Focus>(null)
  const [selectedGroups, setSelectedGroups] = useState<Set<MuscleGroup>>(new Set())
  const [chooseModal, setChooseModal] = useState(false)
  const [suggestReason, setSuggestReason] = useState('')

  const fadeOpacity = useSharedValue(0)
  const fadeY = useSharedValue(24)
  const modalOpacity = useSharedValue(0)
  const modalScale = useSharedValue(0.9)

  useFocusEffect(
    useCallback(() => {
      let cancelled = false

      async function load() {
        const p = await getUserProfile()
        if (cancelled) return
        if (!p) {
          router.replace('/onboarding')
          return
        }
        setProfile(p)
        fadeOpacity.value = withDelay(100, withTiming(1, { duration: 600 }))
        fadeY.value = withDelay(100, withTiming(0, { duration: 500 }))
      }

      setSelectedGroups(new Set())
      setFocus(null)
      load()

      return () => {
        cancelled = true
      }
    }, [])
  )

  const headerStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
    transform: [{ translateY: fadeY.value }],
  }))

  const modalContainerStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
  }))

  const modalCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalScale.value }],
  }))

  function toggleFocus(f: Focus) {
    if (!f) return
    const newFocus = focus === f ? null : f
    setFocus(newFocus)
    if (newFocus) {
      setSelectedGroups(new Set(FOCUS_MUSCLE_MAP[newFocus]))
    } else {
      setSelectedGroups(new Set())
    }
  }

  function toggleGroup(g: MuscleGroup) {
    setFocus(null)
    setSelectedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) {
        next.delete(g)
      } else {
        next.add(g)
      }
      return next
    })
  }

  const hasSelection = selectedGroups.size > 0

  async function handleLetsGo() {
    if (!hasSelection || !profile) return
    const disliked = await getDislikedExercises()
    const groups = Array.from(selectedGroups)
    const exercises = getWorkoutExercises(groups, profile.level, disliked)
    setActiveWorkout({ exercises, muscleGroups: groups })
    router.push('/workout')
  }

  async function handleChooseForMe() {
    if (!profile) return
    const { group, reason } = pickSuggestedGroup(profile.level)
    setSuggestReason(reason)
    const disliked = await getDislikedExercises()
    const exercises = getWorkoutExercises([group], profile.level, disliked)
    setActiveWorkout({ exercises, muscleGroups: [group] })

    setChooseModal(true)
    modalOpacity.value = withTiming(1, { duration: 300 })
    modalScale.value = withSpring(1, { damping: 18, stiffness: 200 })
  }

  function handleProceedFromModal() {
    modalOpacity.value = withTiming(0, { duration: 200 })
    modalScale.value = withTiming(0.9, { duration: 200 })
    setTimeout(() => {
      setChooseModal(false)
      router.push('/workout')
    }, 200)
  }

  if (!profile) return <View style={styles.loading} />

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Greeting */}
        <Animated.View style={[styles.greeting, headerStyle]}>
          <Text style={styles.greetingLabel}>Today's session</Text>
          <Text style={styles.greetingTitle}>
            What do we{'\n'}train today,{'\n'}
            <Text style={styles.greetingName}>{profile.name}?</Text>
          </Text>
        </Animated.View>

        {/* Focus row */}
        <Animated.View style={headerStyle}>
          <Text style={styles.sectionLabel}>Focus</Text>
          <View style={styles.focusRow}>
            {(['upper', 'lower', 'full'] as Exclude<Focus, null>[]).map((f) => {
              const labels = { upper: 'Upper Body', lower: 'Lower Body', full: 'Full Body' }
              const active = focus === f
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.focusCard, active && styles.focusCardActive]}
                  onPress={() => toggleFocus(f)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.focusCardText, active && styles.focusCardTextActive]}>
                    {labels[f]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>

        {/* Muscle groups */}
        <Animated.View style={headerStyle}>
          <Text style={styles.sectionLabel}>Muscle Groups</Text>
          <View style={styles.groupsGrid}>
            {ALL_MUSCLE_GROUPS.map((g) => {
              const active = selectedGroups.has(g)
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.groupCard, active && styles.groupCardActive]}
                  onPress={() => toggleGroup(g)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.groupIcon}>{MUSCLE_GROUP_ICONS[g]}</Text>
                  <Text style={[styles.groupLabel, active && styles.groupLabelActive]}>
                    {MUSCLE_GROUP_LABELS[g]}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </Animated.View>

        {/* Bottom spacing */}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Fixed bottom area */}
      <View style={styles.bottomArea}>
        {/* Choose for me */}
        <TouchableOpacity
          style={styles.chooseMeCard}
          onPress={handleChooseForMe}
          activeOpacity={0.85}
        >
          <Text style={styles.chooseMeIcon}>🎲</Text>
          <View>
            <Text style={styles.chooseMeTitle}>Choose it for me</Text>
            <Text style={styles.chooseMeSubtitle}>Let your coach decide</Text>
          </View>
        </TouchableOpacity>

        {/* Let's Go */}
        <TouchableOpacity
          style={[styles.letsGoBtn, !hasSelection && styles.letsGoBtnDisabled]}
          onPress={handleLetsGo}
          activeOpacity={0.9}
          disabled={!hasSelection}
        >
          <Text style={styles.letsGoBtnText}>Let's Go</Text>
        </TouchableOpacity>
      </View>

      {/* Choose for me modal */}
      <Modal transparent visible={chooseModal} animationType="none">
        <Animated.View style={[styles.modalOverlay, modalContainerStyle]}>
          <Animated.View style={[styles.modalCard, modalCardStyle]}>
            <Text style={styles.modalEmoji}>🎯</Text>
            <Text style={styles.modalReason}>{suggestReason}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handleProceedFromModal} activeOpacity={0.9}>
              <Text style={styles.modalBtnText}>Let's Go 💪</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  loading: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 24 },

  greeting: {
    marginBottom: 40,
  },
  greetingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  greetingTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: C.text,
    lineHeight: 44,
  },
  greetingName: {
    color: C.accent,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  focusRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 32,
  },
  focusCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  focusCardActive: {
    borderColor: C.accent,
    backgroundColor: 'rgba(232,255,71,0.08)',
  },
  focusCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.muted,
  },
  focusCardTextActive: {
    color: C.accent,
  },

  groupsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  groupCard: {
    width: (W - 48 - 10) / 2,
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupCardActive: {
    borderColor: C.accent,
    backgroundColor: 'rgba(232,255,71,0.08)',
  },
  groupIcon: {
    fontSize: 22,
  },
  groupLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: C.muted,
  },
  groupLabelActive: {
    color: C.text,
  },

  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: C.bg,
    gap: 12,
  },
  chooseMeCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  chooseMeIcon: { fontSize: 28 },
  chooseMeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  chooseMeSubtitle: {
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
  },

  letsGoBtn: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  letsGoBtnDisabled: {
    opacity: 0.3,
  },
  letsGoBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  modalEmoji: { fontSize: 52, marginBottom: 20 },
  modalReason: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 28,
  },
  modalBtn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
})
