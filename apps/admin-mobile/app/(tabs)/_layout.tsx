import { Tabs, usePathname, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Animated, Pressable, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '../../src/context/AuthContext'
import { useAlerts } from '../../src/context/AlertsContext'

// ── Config ─────────────────────────────────────────────────────────────────

const SIDEBAR_WIDTH = 280

const NAV_ITEMS = [
  { name: 'index',       href: '/(tabs)/',            label: 'Home',        emoji: '⚡' },
  { name: 'queue',       href: '/(tabs)/queue',        label: 'Proof Queue', emoji: '📋' },
  { name: 'reports',     href: '/(tabs)/reports',      label: 'Moderation',  emoji: '🚩' },
  { name: 'withdrawals', href: '/(tabs)/withdrawals',  label: 'Withdrawals', emoji: '💸' },
  { name: 'users',       href: '/(tabs)/users',        label: 'Users',       emoji: '👥' },
  { name: 'docker',      href: '/(tabs)/docker',       label: 'Docker',      emoji: '🐳' },
] as const

const SCREEN_TITLES: Record<string, string> = {
  '/(tabs)/':            'Home',
  '/(tabs)/queue':       'Proof Queue',
  '/(tabs)/reports':     'Moderation',
  '/(tabs)/withdrawals': 'Withdrawals',
  '/(tabs)/users':       'Users',
  '/(tabs)/docker':      'Docker',
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const [open, setOpen]      = useState(false)
  const slideAnim            = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current
  const overlayAnim          = useRef(new Animated.Value(0)).current
  const router               = useRouter()
  const pathname             = usePathname()
  const insets               = useSafeAreaInsets()
  const counts               = useAlerts()
  const { user, logout }     = useAuth()

  const currentTitle = SCREEN_TITLES[pathname] ?? 'TCG Admin'

  // ── Animation helpers ──────────────────────────────────────────────────

  const openSidebar = () => {
    setOpen(true)
    Animated.parallel([
      Animated.timing(slideAnim,  { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]).start()
  }

  const closeSidebar = (onDone?: () => void) => {
    Animated.parallel([
      Animated.timing(slideAnim,  { toValue: -SIDEBAR_WIDTH, duration: 210, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0,             duration: 210, useNativeDriver: true }),
    ]).start(() => { setOpen(false); onDone?.() })
  }

  // ── Nav helpers ────────────────────────────────────────────────────────

  const navigate = (href: string) => {
    closeSidebar(() => router.navigate(href as any))
  }

  const getBadge = (name: string) => {
    switch (name) {
      case 'queue':       return counts.proofQueue
      case 'reports':     return counts.reports + counts.reviews + counts.disputes
      case 'withdrawals': return counts.withdrawals
      default:            return 0
    }
  }

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.href === '/(tabs)/') return pathname === '/(tabs)/' || pathname === '/'
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: '#16171c' }}>

      {/* ── Top header bar ────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: '#191a20',
          borderBottomWidth: 1,
          borderBottomColor: '#31365e',
        }}
      >
        <View
          style={{
            height: 52,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
          }}
        >
          <TouchableOpacity
            onPress={openSidebar}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.6}
          >
            {/* Three-line hamburger drawn manually for crisp rendering */}
            <View style={{ gap: 5 }}>
              <View style={{ width: 20, height: 2, backgroundColor: '#f7f8fa', borderRadius: 1 }} />
              <View style={{ width: 16, height: 2, backgroundColor: '#8f98bc', borderRadius: 1 }} />
              <View style={{ width: 20, height: 2, backgroundColor: '#f7f8fa', borderRadius: 1 }} />
            </View>
          </TouchableOpacity>

          <Text
            style={{
              marginLeft: 10,
              color: '#f7f8fa',
              fontSize: 17,
              fontFamily: 'Inter_600SemiBold',
              fontWeight: '600',
              flex: 1,
            }}
            numberOfLines={1}
          >
            {currentTitle}
          </Text>
        </View>
      </View>

      {/* ── Screen content (tabs with hidden bar) ─────────────────────── */}
      <View style={{ flex: 1 }}>
        <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
          {NAV_ITEMS.map(item => (
            <Tabs.Screen key={item.name} name={item.name} options={{ title: item.label }} />
          ))}
        </Tabs>
      </View>

      {/* ── Sidebar overlay (only mounted while open/animating) ────────── */}
      {open && (
        <>
          {/* Scrim — tap anywhere outside to dismiss */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 100,
              opacity: overlayAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.55],
              }),
              backgroundColor: '#000',
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={() => closeSidebar()} />
          </Animated.View>

          {/* Sidebar panel */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0, left: 0, bottom: 0,
              width: SIDEBAR_WIDTH,
              backgroundColor: '#191a20',
              borderRightWidth: 1,
              borderRightColor: '#31365e',
              transform: [{ translateX: slideAnim }],
              zIndex: 200,
            }}
          >
            {/* User info header */}
            <View
              style={{
                paddingTop: insets.top + 20,
                paddingHorizontal: 20,
                paddingBottom: 20,
                borderBottomWidth: 1,
                borderBottomColor: '#31365e',
              }}
            >
              <Text
                style={{
                  color: '#f7f8fa',
                  fontSize: 18,
                  fontFamily: 'Inter_700Bold',
                  fontWeight: 'bold',
                  marginBottom: 3,
                }}
              >
                TCG Admin
              </Text>
              <Text
                style={{
                  color: '#8f98bc',
                  fontSize: 12,
                  fontFamily: 'Inter_400Regular',
                }}
                numberOfLines={1}
              >
                {user?.username ?? user?.email ?? ''}
              </Text>
            </View>

            {/* Nav items */}
            <View style={{ flex: 1, paddingTop: 8 }}>
              {NAV_ITEMS.map(item => {
                const active = isActive(item)
                const badge  = getBadge(item.name)
                return (
                  <TouchableOpacity
                    key={item.name}
                    onPress={() => navigate(item.href)}
                    activeOpacity={0.65}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 18,
                      paddingVertical: 14,
                      backgroundColor: active ? 'rgba(41,99,255,0.12)' : 'transparent',
                      borderLeftWidth: active ? 3 : 0,
                      borderLeftColor: '#2963FF',
                    }}
                  >
                    <Text style={{ fontSize: 18, marginRight: 14 }}>{item.emoji}</Text>
                    <Text
                      style={{
                        flex: 1,
                        color: active ? '#f7f8fa' : '#8f98bc',
                        fontSize: 15,
                        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
                      }}
                    >
                      {item.label}
                    </Text>
                    {badge > 0 && (
                      <View
                        style={{
                          backgroundColor: '#ef4444',
                          borderRadius: 10,
                          minWidth: 20,
                          height: 20,
                          paddingHorizontal: 5,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: '#fff',
                            fontSize: 10,
                            fontFamily: 'Inter_600SemiBold',
                            lineHeight: 20,
                          }}
                        >
                          {badge > 99 ? '99+' : badge}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Sign out at bottom */}
            <TouchableOpacity
              onPress={() => closeSidebar(() => { logout() })}
              activeOpacity={0.7}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 16,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                borderTopWidth: 1,
                borderTopColor: '#31365e',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Text style={{ fontSize: 18 }}>🚪</Text>
              <Text
                style={{
                  color: '#8f98bc',
                  fontSize: 15,
                  fontFamily: 'Inter_400Regular',
                }}
              >
                Sign out
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  )
}
