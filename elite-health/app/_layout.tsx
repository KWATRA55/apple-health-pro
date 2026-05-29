import '../global.css'
import 'expo-dev-client'

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { View } from 'react-native'
import { useEffect } from 'react'

// Background sync task definition (must be at global scope, before any component renders)
import * as TaskManager from 'expo-task-manager'
import { BACKGROUND_HEALTH_SYNC_TASK } from '../src/lib/services/background-sync'
import { useHealthStore } from '../src/lib/store'

import Constants from 'expo-constants'

TaskManager.defineTask(BACKGROUND_HEALTH_SYNC_TASK, async () => {
  try {
    console.log('[BG-SYNC] Background sync triggered')
    const { syncHealthKit } = useHealthStore.getState()
    await syncHealthKit()
    console.log('[BG-SYNC] Background sync complete')
    return 'newData'
  } catch (error) {
    console.error('[BG-SYNC] Background sync failed:', error)
    return 'failed'
  }
})

export default function RootLayout() {
  const { loadFromDB, syncHealthKit } = useHealthStore()

  useEffect(() => {
    // 1. Load cached DB data immediately for instant UI render
    // 2. Then sync fresh data from HealthKit (overwrites stale mocks)
    loadFromDB().then(() => {
      syncHealthKit()

      // Auto-generate runtime snapshot and send to local receiver script
      setTimeout(() => {
        import('../scratch/generate').then(({ generateRuntimeSnapshot }) => {
          generateRuntimeSnapshot(false).then(snapshot => {
            // Send snapshot via the secure public SSH tunnel to guarantee reachability
            const tunnelUrl = 'https://5e5d3be46e7966.lhr.life';
            console.log(`[SNAPSHOT] Posting runtime snapshot to SSH tunnel: ${tunnelUrl}`);

            fetch(tunnelUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(snapshot)
            }).then(() => console.log('[SNAPSHOT] Successfully posted runtime snapshot to local receiver server'))
              .catch(e => console.log('[SNAPSHOT] Failed to post snapshot:', e.message));
          });
        });
      }, 3000); // give app 3s to settle DB load
    })

    // Register background sync (non-blocking, silently no-ops in Expo Go)
    import('../src/lib/services/background-sync').then(({ registerBackgroundHealthSync }) => {
      registerBackgroundHealthSync()
    })
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#000000' },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="drilldown/sleep"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
          <Stack.Screen
            name="drilldown/debug"
            options={{
              presentation: 'card',
              animation: 'slide_from_right',
            }}
          />
        </Stack>
        <StatusBar style="light" />
      </View>
    </GestureHandlerRootView>
  )
}
