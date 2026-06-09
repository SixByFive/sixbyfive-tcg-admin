import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAuth } from '../src/context/AuthContext'

export default function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')
    try {
      await login(email.trim().toLowerCase(), password)
    } catch (e: any) {
      setError(e?.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="flex-1 items-center justify-center px-8">
        <Text className="mb-1 text-3xl font-bold text-text" style={{ fontFamily: 'Inter_700Bold' }}>
          TCG Admin
        </Text>
        <Text className="mb-10 text-sm text-text-muted" style={{ fontFamily: 'Inter_400Regular' }}>
          Sign in to your admin account
        </Text>

        <View className="w-full gap-3">
          <TextInput
            className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-text"
            style={{ fontFamily: 'Inter_400Regular' }}
            placeholder="Email"
            placeholderTextColor="#8f98bc"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
          />
          <TextInput
            className="w-full rounded-xl border border-border bg-surface px-4 py-3.5 text-sm text-text"
            style={{ fontFamily: 'Inter_400Regular' }}
            placeholder="Password"
            placeholderTextColor="#8f98bc"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />

          {error ? (
            <Text className="text-center text-xs text-destructive" style={{ fontFamily: 'Inter_400Regular' }}>
              {error}
            </Text>
          ) : null}

          <TouchableOpacity
            className="mt-2 w-full items-center rounded-xl bg-accent py-3.5"
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-sm font-semibold text-white" style={{ fontFamily: 'Inter_600SemiBold' }}>Sign In</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}
