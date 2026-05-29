import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import Constants, { AppOwnership } from 'expo-constants'

export const BACKGROUND_HEALTH_SYNC_TASK = 'KILO_HEALTH_BACKGROUND_SYNC'

/**
 * Registers the background fetch task for hourly HealthKit synchronization.
 * Called once during app initialization (e.g., in _layout.tsx).
 *
 * The task fires approximately every 60 minutes when the app is backgrounded.
 * On iOS, the actual interval is determined by the system (10-15 min minimum).
 */
export async function registerBackgroundHealthSync(): Promise<void> {
  try {
    if (Constants.appOwnership === AppOwnership.Expo) {
      console.warn('Background task is not supported in Expo Go. Skipping registration.')
      return
    }

    const status = await BackgroundTask.getStatusAsync()

    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn('Background task is restricted. Health sync will only run in foreground.')
      return
    }

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEALTH_SYNC_TASK)

    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_HEALTH_SYNC_TASK, {
        minimumInterval: 60, // 60 minutes
      })
      console.log('Background health sync registered (60 min interval).')
    }
  } catch (error) {
    console.error('Failed to register background health sync:', error)
  }
}

/**
 * Unregisters the background health sync task. Useful for settings toggles.
 */
export async function unregisterBackgroundHealthSync(): Promise<void> {
  try {
    if (Constants.appOwnership === AppOwnership.Expo) {
      return
    }
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEALTH_SYNC_TASK)
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_HEALTH_SYNC_TASK)
      console.log('Background health sync unregistered.')
    }
  } catch (error) {
    console.error('Failed to unregister background health sync:', error)
  }
}

/**
 * Checks if background sync is currently available.
 */
export async function isBackgroundSyncAvailable(): Promise<boolean> {
  try {
    if (Constants.appOwnership === AppOwnership.Expo) {
      return false
    }
    const status = await BackgroundTask.getStatusAsync()
    return status === BackgroundTask.BackgroundTaskStatus.Available
  } catch {
    return false
  }
}
