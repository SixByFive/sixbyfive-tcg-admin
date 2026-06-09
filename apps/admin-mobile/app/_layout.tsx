import '../global.css'
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter'
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from '../src/context/AuthContext'
import { AlertsProvider } from '../src/context/AlertsContext'

SplashScreen.preventAutoHideAsync()

function AuthGate() {
  const { user, isLoading } = useAuth()
  const segments = useSegments()
  const router   = useRouter()

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold })

  useEffect(() => {
    if (!fontsLoaded || isLoading) return
    SplashScreen.hideAsync()

    const inAuth = segments[0] === 'login'
    if (!user && !inAuth) router.replace('/login')
    if (user && inAuth)  router.replace('/(tabs)')
  }, [user, isLoading, fontsLoaded])

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  )
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AlertsProvider>
        <AuthGate />
      </AlertsProvider>
    </AuthProvider>
  )
}
