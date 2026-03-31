import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { saveUserProfile } from '../lib/storage'

const { width: W } = Dimensions.get('window')

const C = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  accent: '#E8FF47',
  text: '#FFFFFF',
  muted: '#555555',
  border: '#2A2A2A',
  cardBorder: '#2A2A2A',
}

const TOTAL_STEPS = 5

// ─── Height / Weight picker data ───────────────────────────────────────────────

const CM_VALUES = Array.from({ length: 81 }, (_, i) => `${i + 140} cm`)
const FT_VALUES = Array.from({ length: 30 }, (_, i) => {
  const totalInches = 54 + i
  const ft = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${ft}'${inches === 0 ? '0' : inches}"`
})
const KG_VALUES = Array.from({ length: 111 }, (_, i) => `${i + 40} kg`)
const LBS_VALUES = Array.from({ length: 244 }, (_, i) => `${i + 88} lbs`)

const DEFAULT_HEIGHT_CM = 30 // 170 cm
const DEFAULT_HEIGHT_FT = 10 // 5'4"
const DEFAULT_WEIGHT_KG = 30 // 70 kg
const DEFAULT_WEIGHT_LBS = 52 // 140 lbs

// ─── WheelPicker ───────────────────────────────────────────────────────────────

const ITEM_H = 56

interface WheelPickerProps {
  items: string[]
  initialIndex: number
  onSelect: (index: number) => void
}

function WheelPicker({ items, initialIndex, onSelect }: WheelPickerProps) {
  const [selected, setSelected] = useState(initialIndex)
  const listRef = useRef<FlatList>(null)

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H)
      const clamped = Math.max(0, Math.min(idx, items.length - 1))
      setSelected(clamped)
      onSelect(clamped)
    },
    [items.length, onSelect]
  )

  return (
    <View style={styles.pickerWrapper}>
      <View style={styles.pickerHighlight} pointerEvents="none" />
      <View style={styles.pickerFadeTop} pointerEvents="none" />
      <View style={styles.pickerFadeBottom} pointerEvents="none" />
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(_, i) => String(i)}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        extraData={selected}
        renderItem={({ index, item }) => (
          <View style={[styles.pickerItem, { height: ITEM_H }]}>
            <Text
              style={[
                styles.pickerItemText,
                selected === index && styles.pickerItemTextSelected,
              ]}
            >
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type Sex = 'male' | 'female' | 'prefer_not'
type Level = 'beginner' | 'intermediate' | 'advanced'

interface FormData {
  name: string
  sex: Sex | null
  heightIndex: number
  heightUnit: 'cm' | 'ft'
  weightIndex: number
  weightUnit: 'kg' | 'lbs'
  level: Level | null
}

export default function OnboardingScreen() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>({
    name: '',
    sex: null,
    heightIndex: DEFAULT_HEIGHT_CM,
    heightUnit: 'cm',
    weightIndex: DEFAULT_WEIGHT_KG,
    weightUnit: 'kg',
    level: null,
  })

  const slideX = useSharedValue(0)
  const slideOpacity = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
    opacity: slideOpacity.value,
  }))

  function isStepValid(): boolean {
    switch (step) {
      case 0:
        return form.name.trim().length > 0
      case 1:
        return form.sex !== null
      case 2:
        return true
      case 3:
        return true
      case 4:
        return form.level !== null
      default:
        return false
    }
  }

  function goNext() {
    if (!isStepValid()) return
    Keyboard.dismiss()

    const next = step + 1

    slideX.value = withTiming(
      -W,
      { duration: 280, easing: Easing.out(Easing.cubic) },
      () => {
        runOnJS(setStep)(next)
        slideX.value = W
        slideOpacity.value = 0
        slideX.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })
        slideOpacity.value = withTiming(1, { duration: 200 })
      }
    )
  }

  async function handleFinish() {
    if (!isStepValid()) return

    const heightValues = form.heightUnit === 'cm' ? CM_VALUES : FT_VALUES
    const weightValues = form.weightUnit === 'kg' ? KG_VALUES : LBS_VALUES
    const heightRaw = parseInt(heightValues[form.heightIndex])
    const weightRaw = parseInt(weightValues[form.weightIndex])

    await saveUserProfile({
      name: form.name.trim(),
      sex: form.sex!,
      height: heightRaw,
      heightUnit: form.heightUnit,
      weight: weightRaw,
      weightUnit: form.weightUnit,
      level: form.level!,
    })

    router.replace('/')
  }

  const isLast = step === TOTAL_STEPS - 1

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${((step + 1) / TOTAL_STEPS) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Animated step content */}
        <Animated.View style={[styles.stepContainer, animStyle]}>
          {step === 0 && (
            <StepName
              value={form.name}
              onChange={(name) => setForm((f) => ({ ...f, name }))}
            />
          )}
          {step === 1 && (
            <StepSex
              value={form.sex}
              onChange={(sex) => setForm((f) => ({ ...f, sex }))}
            />
          )}
          {step === 2 && (
            <StepHeight
              heightIndex={form.heightIndex}
              heightUnit={form.heightUnit}
              onChangeIndex={(i) => setForm((f) => ({ ...f, heightIndex: i }))}
              onChangeUnit={(u) => setForm((f) => ({ ...f, heightUnit: u, heightIndex: u === 'cm' ? DEFAULT_HEIGHT_CM : DEFAULT_HEIGHT_FT }))}
            />
          )}
          {step === 3 && (
            <StepWeight
              weightIndex={form.weightIndex}
              weightUnit={form.weightUnit}
              onChangeIndex={(i) => setForm((f) => ({ ...f, weightIndex: i }))}
              onChangeUnit={(u) => setForm((f) => ({ ...f, weightUnit: u, weightIndex: u === 'kg' ? DEFAULT_WEIGHT_KG : DEFAULT_WEIGHT_LBS }))}
            />
          )}
          {step === 4 && (
            <StepLevel
              value={form.level}
              onChange={(level) => setForm((f) => ({ ...f, level }))}
            />
          )}
        </Animated.View>

        {/* CTA button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, !isStepValid() && styles.buttonDisabled]}
            onPress={isLast ? handleFinish : goNext}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{isLast ? "Let's Start" : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Step components ───────────────────────────────────────────────────────────

function StepName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepLabel}>Step 1 of 5</Text>
      <Text style={styles.stepTitle}>What's your name?</Text>
      <Text style={styles.stepSubtitle}>This is how we'll greet you every workout.</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder="Your first name"
        placeholderTextColor={C.muted}
        autoFocus
        returnKeyType="done"
        autoCapitalize="words"
        selectionColor={C.accent}
      />
    </View>
  )
}

function StepSex({
  value,
  onChange,
}: {
  value: Sex | null
  onChange: (v: Sex) => void
}) {
  const options: { id: Sex; label: string; icon: string }[] = [
    { id: 'male', label: 'Male', icon: '♂' },
    { id: 'female', label: 'Female', icon: '♀' },
    { id: 'prefer_not', label: 'Prefer not to say', icon: '·' },
  ]
  return (
    <View style={styles.step}>
      <Text style={styles.stepLabel}>Step 2 of 5</Text>
      <Text style={styles.stepTitle}>What's your sex?</Text>
      <Text style={styles.stepSubtitle}>Helps us calibrate your workout estimates.</Text>
      <View style={styles.cardGrid}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[styles.selectCard, value === o.id && styles.selectCardActive]}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.selectCardIcon}>{o.icon}</Text>
            <Text style={[styles.selectCardLabel, value === o.id && styles.selectCardLabelActive]}>
              {o.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function StepHeight({
  heightIndex,
  heightUnit,
  onChangeIndex,
  onChangeUnit,
}: {
  heightIndex: number
  heightUnit: 'cm' | 'ft'
  onChangeIndex: (i: number) => void
  onChangeUnit: (u: 'cm' | 'ft') => void
}) {
  const items = heightUnit === 'cm' ? CM_VALUES : FT_VALUES
  return (
    <View style={styles.step}>
      <Text style={styles.stepLabel}>Step 3 of 5</Text>
      <Text style={styles.stepTitle}>How tall are you?</Text>
      <Text style={styles.stepSubtitle}>Scroll to your height.</Text>
      <View style={styles.unitToggle}>
        {(['cm', 'ft'] as const).map((u) => (
          <TouchableOpacity
            key={u}
            style={[styles.unitBtn, heightUnit === u && styles.unitBtnActive]}
            onPress={() => onChangeUnit(u)}
          >
            <Text style={[styles.unitBtnText, heightUnit === u && styles.unitBtnTextActive]}>
              {u}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <WheelPicker
        key={heightUnit}
        items={items}
        initialIndex={heightIndex}
        onSelect={onChangeIndex}
      />
    </View>
  )
}

function StepWeight({
  weightIndex,
  weightUnit,
  onChangeIndex,
  onChangeUnit,
}: {
  weightIndex: number
  weightUnit: 'kg' | 'lbs'
  onChangeIndex: (i: number) => void
  onChangeUnit: (u: 'kg' | 'lbs') => void
}) {
  const items = weightUnit === 'kg' ? KG_VALUES : LBS_VALUES
  return (
    <View style={styles.step}>
      <Text style={styles.stepLabel}>Step 4 of 5</Text>
      <Text style={styles.stepTitle}>How much do you weigh?</Text>
      <Text style={styles.stepSubtitle}>Scroll to your weight.</Text>
      <View style={styles.unitToggle}>
        {(['kg', 'lbs'] as const).map((u) => (
          <TouchableOpacity
            key={u}
            style={[styles.unitBtn, weightUnit === u && styles.unitBtnActive]}
            onPress={() => onChangeUnit(u)}
          >
            <Text style={[styles.unitBtnText, weightUnit === u && styles.unitBtnTextActive]}>
              {u}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <WheelPicker
        key={weightUnit}
        items={items}
        initialIndex={weightIndex}
        onSelect={onChangeIndex}
      />
    </View>
  )
}

function StepLevel({
  value,
  onChange,
}: {
  value: Level | null
  onChange: (v: Level) => void
}) {
  const options: { id: Level; label: string; icon: string; desc: string }[] = [
    { id: 'beginner', label: 'Beginner', icon: '🌱', desc: 'New to training or returning after a break' },
    { id: 'intermediate', label: 'Intermediate', icon: '⚡', desc: 'Training consistently for 6+ months' },
    { id: 'advanced', label: 'Advanced', icon: '🔥', desc: 'Years of structured training under your belt' },
  ]
  return (
    <View style={styles.step}>
      <Text style={styles.stepLabel}>Step 5 of 5</Text>
      <Text style={styles.stepTitle}>What's your level?</Text>
      <Text style={styles.stepSubtitle}>We'll tailor exercises to match your experience.</Text>
      <View style={styles.levelGrid}>
        {options.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[styles.levelCard, value === o.id && styles.levelCardActive]}
            onPress={() => onChange(o.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.levelIcon}>{o.icon}</Text>
            <Text style={[styles.levelLabel, value === o.id && styles.levelLabelActive]}>
              {o.label}
            </Text>
            <Text style={styles.levelDesc}>{o.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressTrack: {
    height: 3,
    backgroundColor: C.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.accent,
    borderRadius: 2,
  },

  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  step: {
    flex: 1,
    paddingTop: 32,
  },

  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
    lineHeight: 36,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: C.muted,
    marginBottom: 32,
  },

  textInput: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 20,
    fontWeight: '600',
    color: C.text,
  },

  cardGrid: {
    gap: 12,
  },
  selectCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    paddingVertical: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  selectCardActive: {
    borderColor: C.accent,
    backgroundColor: 'rgba(232,255,71,0.06)',
  },
  selectCardIcon: {
    fontSize: 24,
    color: C.muted,
    width: 32,
    textAlign: 'center',
  },
  selectCardLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  selectCardLabelActive: {
    color: C.accent,
  },

  unitToggle: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  unitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  unitBtnActive: {
    backgroundColor: C.accent,
  },
  unitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: C.muted,
  },
  unitBtnTextActive: {
    color: '#000',
  },

  pickerWrapper: {
    height: ITEM_H * 5,
    overflow: 'hidden',
    position: 'relative',
  },
  pickerHighlight: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 0,
    right: 0,
    height: ITEM_H,
    backgroundColor: 'rgba(232,255,71,0.06)',
    borderRadius: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(232,255,71,0.2)',
    zIndex: 1,
  },
  pickerFadeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    zIndex: 2,
  },
  pickerFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: ITEM_H * 2,
    zIndex: 2,
  },
  pickerItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerItemText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#3A3A3A',
  },
  pickerItemTextSelected: {
    fontSize: 26,
    fontWeight: '700',
    color: C.accent,
  },

  levelGrid: {
    gap: 12,
  },
  levelCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
    padding: 20,
  },
  levelCardActive: {
    borderColor: C.accent,
    backgroundColor: 'rgba(232,255,71,0.06)',
  },
  levelIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 20,
    fontWeight: '800',
    color: C.text,
    marginBottom: 4,
  },
  levelLabelActive: {
    color: C.accent,
  },
  levelDesc: {
    fontSize: 14,
    color: C.muted,
    lineHeight: 20,
  },

  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
  button: {
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.35,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.3,
  },
})
