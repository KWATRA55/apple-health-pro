import { Tabs } from 'expo-router'
import { Text, View, Platform } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

// ── STITCH Design Tokens ──────────────────────────────────────────────
const S = {
  primaryFixedDim: '#7ad7c6',
  dimText: 'rgba(255,255,255,0.40)',
}

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, keyof typeof MaterialIcons.glyphMap> = {
    index: 'home', // 'home_health' is not in all versions, using 'home' as fallback
    health: 'monitor-heart', // fallback for 'monitoring'
    coach: 'psychology',
    profile: 'person',
  }
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      <MaterialIcons
        name={icons[name]}
        size={26}
        color={focused ? S.primaryFixedDim : S.dimText}
        style={focused ? {
          textShadowColor: 'rgba(122,215,198,0.4)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
        } : {}}
      />
    </View>
  )
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        lazy: true,
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'rgba(18,18,20,0.95)',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 0.5,
          height: 90,
          paddingBottom: 28,
          paddingTop: 8,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.5,
          shadowRadius: 32,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
        },
        tabBarActiveTintColor: S.primaryFixedDim,
        tabBarInactiveTintColor: S.dimText,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="index" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="health"
        options={{
          title: 'Health',
          tabBarIcon: ({ focused }) => <TabIcon name="health" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ focused }) => <TabIcon name="coach" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
