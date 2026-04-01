import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { C } from '../lib/theme'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index"     options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'none' }} />
        <Stack.Screen name="workout"   options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="complete"  options={{ animation: 'slide_from_right', gestureEnabled: false }} />
        <Stack.Screen name="dashboard" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  )
}
