import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { useRouter, useFocusEffect } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { C, MUSCLE_COLORS } from '../lib/theme'
import { getDashboardStats, DashboardStats, WorkoutRecord } from '../lib/storage'
import { EXERCISES, MUSCLE_GROUP_LABELS, MUSCLE_GROUP_ICONS } from '../lib/workoutData'

// ─── Animated stat card ───────────────────────────────────────────────────────

function StatCard({ icon, value, label, index }: {
  icon: string; value: string; label: string; index: number
}) {
  const opacity = useSharedValue(0)
  const y       = useSharedValue(16)

  useEffect(() => {
    opacity.value = withDelay(index * 80 + 100, withTiming(1, { duration: 350 }))
    y.value       = withDelay(index * 80 + 100, withTiming(0, { duration: 300 }))
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: y.value }],
  }))

  return (
    <Animated.View style={[ds.statCard, style]}>
      <Text style={ds.statIcon}>{icon}</Text>
      <Text style={ds.statValue}>{value}</Text>
      <Text style={ds.statLabel}>{label}</Text>
    </Animated.View>
  )
}

// ─── Single animated bar (extracted to avoid hooks-in-map) ───────────────────

function VolumeBar({ value, maxVal, index, isLatest }: {
  value: number; maxVal: number; index: number; isLatest: boolean
}) {
  const pct  = maxVal > 0 ? value / maxVal : 0
  const barH = useSharedValue(0)
  const labels = ['7w', '6w', '5w', '4w', '3w', '2w', 'lw', 'Now']

  useEffect(() => {
    barH.value = withDelay(index * 50 + 300, withSpring(pct, { damping: 14, stiffness: 100 }))
  }, [])

  const barStyle = useAnimatedStyle(() => ({
    height: `${barH.value * 100}%`,
  }))

  return (
    <View style={ds.barWrap}>
      <View style={ds.barTrack}>
        <Animated.View
          style={[ds.bar, { backgroundColor: isLatest ? C.purple : C.blue + 'AA' }, barStyle]}
        />
      </View>
      <Text style={ds.barLabel}>{labels[index]}</Text>
      {value > 0 && <Text style={ds.barValue}>{Math.round(value)}</Text>}
    </View>
  )
}

function WeeklyChart({ data }: { data: number[] }) {
  const maxVal = Math.max(...data, 1)
  return (
    <View style={ds.chartSection}>
      <Text style={ds.sectionTitle}>Volume per Week</Text>
      <Text style={ds.sectionSub}>Total kg lifted (sets × reps × weight)</Text>
      <View style={ds.chart}>
        {data.map((v, i) => (
          <VolumeBar key={i} value={v} maxVal={maxVal} index={i} isLatest={i === 7} />
        ))}
      </View>
    </View>
  )
}

// ─── Single muscle bar ───────────────────────────────────────────────────────

function MuscleBar({ group, count, maxFreq, index }: {
  group: string; count: number; maxFreq: number; index: number
}) {
  const pct   = maxFreq > 0 ? count / maxFreq : 0
  const color = MUSCLE_COLORS[group] ?? C.purple
  const width = useSharedValue(0)

  useEffect(() => {
    width.value = withDelay(index * 60 + 200, withTiming(pct, { duration: 500 }))
  }, [])

  const barStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }))

  return (
    <View style={ds.muscleRow}>
      <Text style={ds.muscleRowIcon}>{MUSCLE_GROUP_ICONS[group as keyof typeof MUSCLE_GROUP_ICONS]}</Text>
      <Text style={ds.muscleRowLabel}>{MUSCLE_GROUP_LABELS[group as keyof typeof MUSCLE_GROUP_LABELS]}</Text>
      <View style={ds.muscleBarTrack}>
        <Animated.View style={[ds.muscleBar, { backgroundColor: color }, barStyle]} />
      </View>
      <Text style={[ds.muscleRowCount, { color }]}>{count}×</Text>
    </View>
  )
}

function MuscleBreakdown({ freq }: { freq: Record<string, number> }) {
  const groups = Object.keys(MUSCLE_GROUP_LABELS)
  const maxFreq = Math.max(...groups.map((g) => freq[g] ?? 0), 1)

  return (
    <View style={ds.section}>
      <Text style={ds.sectionTitle}>Muscle Balance</Text>
      <Text style={ds.sectionSub}>Sessions per muscle group (all time)</Text>
      <View style={ds.muscleList}>
        {groups.map((g, i) => (
          <MuscleBar key={g} group={g} count={freq[g] ?? 0} maxFreq={maxFreq} index={i} />
        ))}
      </View>
    </View>
  )
}

// ─── Personal records ────────────────────────────────────────────────────────

function PersonalRecords({ records }: {
  records: Record<string, { weightKg: number; date: string }>
}) {
  const entries = Object.entries(records)
    .map(([id, r]) => {
      const ex = EXERCISES.find((e) => e.id === id)
      return ex ? { ...r, name: ex.name, muscleGroup: ex.muscleGroup } : null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, 8)

  if (entries.length === 0) return null

  return (
    <View style={ds.section}>
      <Text style={ds.sectionTitle}>Personal Records 🏆</Text>
      <Text style={ds.sectionSub}>Best weight per exercise</Text>
      {entries.map((r, i) => {
        const color = MUSCLE_COLORS[r.muscleGroup] ?? C.purple
        return (
          <View key={i} style={ds.prRow}>
            <View style={[ds.prDot, { backgroundColor: color }]} />
            <Text style={ds.prName}>{r.name}</Text>
            <Text style={[ds.prWeight, { color }]}>{r.weightKg} kg</Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Recent workouts ─────────────────────────────────────────────────────────

function RecentWorkouts({ workouts }: { workouts: WorkoutRecord[] }) {
  if (workouts.length === 0) return null
  return (
    <View style={ds.section}>
      <Text style={ds.sectionTitle}>Recent Sessions</Text>
      {workouts.map((w) => {
        const date   = new Date(w.date)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const groups = w.muscleGroups
          .map((g) => (MUSCLE_GROUP_LABELS as Record<string,string>)[g] ?? g)
          .join(' · ')
        return (
          <View key={w.id} style={ds.recentRow}>
            <View style={ds.recentLeft}>
              <Text style={ds.recentGroups}>{groups}</Text>
              <Text style={ds.recentMeta}>
                {w.totalSets} sets · {w.estimatedCalories} kcal
                {w.totalVolumeKg > 0 ? ` · ${w.totalVolumeKg} kg` : ''}
              </Text>
            </View>
            <Text style={ds.recentDate}>{dateStr}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)

  const fadeOpacity = useSharedValue(0)

  useFocusEffect(
    useCallback(() => {
      getDashboardStats().then((s) => {
        setStats(s)
        fadeOpacity.value = withTiming(1, { duration: 400 })
      })
    }, [])
  )

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeOpacity.value }))

  return (
    <SafeAreaView style={ds.safe}>
      <View style={ds.header}>
        <TouchableOpacity style={ds.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={ds.backBtnText}>←</Text>
        </TouchableOpacity>
        <Text style={ds.headerTitle}>Your Progress</Text>
        <View style={{ width: 40 }} />
      </View>

      {!stats ? (
        <View style={ds.loading}>
          <Text style={ds.loadingText}>Loading your stats...</Text>
        </View>
      ) : stats.totalWorkouts === 0 ? (
        <View style={ds.empty}>
          <Text style={ds.emptyIcon}>📊</Text>
          <Text style={ds.emptyTitle}>No workouts yet</Text>
          <Text style={ds.emptySub}>Complete your first session to see your progress here.</Text>
          <TouchableOpacity style={ds.emptyBtn} onPress={() => router.replace('/')} activeOpacity={0.9}>
            <Text style={ds.emptyBtnText}>Start Training</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          style={[fadeStyle, { backgroundColor: C.bg }]}
          contentContainerStyle={ds.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={ds.statsRow}>
            <StatCard icon="🏋️" value={String(stats.totalWorkouts)} label="Workouts" index={0} />
            <StatCard icon="🔁" value={String(stats.totalSets)}     label="Total Sets" index={1} />
            <StatCard icon="⚖️" value={`${stats.totalVolumeKg}`}    label="kg Lifted"  index={2} />
          </View>

          <WeeklyChart    data={stats.weeklyVolume} />
          <MuscleBreakdown freq={stats.muscleFrequency} />
          <PersonalRecords records={stats.personalRecords} />
          <RecentWorkouts  workouts={stats.recentWorkouts} />

          <View style={{ height: 40 }} />
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const ds = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { paddingHorizontal: 20, paddingTop: 8 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: C.textMuted, fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  backBtn:     { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  backBtnText: { fontSize: 22, color: C.purple, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon:    { fontSize: 56, marginBottom: 16 },
  emptyTitle:   { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  emptyBtn:     { backgroundColor: C.purple, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32 },
  emptyBtnText: { fontSize: 16, fontWeight: '800', color: '#FFF' },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 20, borderWidth: 1,
    borderColor: C.border, padding: 16, alignItems: 'center',
  },
  statIcon:  { fontSize: 22, marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800', color: C.purple, marginBottom: 2 },
  statLabel: { fontSize: 11, fontWeight: '600', color: C.textMuted, textAlign: 'center' },

  chartSection: {
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1,
    borderColor: C.border, padding: 20, marginBottom: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 2 },
  sectionSub:   { fontSize: 12, color: C.textMuted, marginBottom: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
  barWrap:  { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: {
    width: '100%', height: '85%', justifyContent: 'flex-end',
    borderRadius: 6, overflow: 'hidden', backgroundColor: C.border,
  },
  bar:      { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 8,  color: C.textMuted, marginTop: 4, textAlign: 'center' },
  barValue: { fontSize: 7,  color: C.purple, marginTop: 1, textAlign: 'center' },

  section: {
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1,
    borderColor: C.border, padding: 20, marginBottom: 16,
  },
  muscleList: { gap: 10, marginTop: 4 },
  muscleRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  muscleRowIcon:    { fontSize: 18, width: 24 },
  muscleRowLabel:   { fontSize: 13, fontWeight: '600', color: C.textDim, width: 76 },
  muscleBarTrack:   { flex: 1, height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' },
  muscleBar:        { height: '100%', borderRadius: 4 },
  muscleRowCount:   { fontSize: 13, fontWeight: '700', width: 28, textAlign: 'right' },

  prRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: C.border },
  prDot:    { width: 8, height: 8, borderRadius: 4 },
  prName:   { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  prWeight: { fontSize: 16, fontWeight: '800' },

  recentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderColor: C.border,
  },
  recentLeft:   { flex: 1 },
  recentGroups: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 3 },
  recentMeta:   { fontSize: 12, color: C.textMuted },
  recentDate:   { fontSize: 12, fontWeight: '600', color: C.textMuted, marginLeft: 12 },
})
