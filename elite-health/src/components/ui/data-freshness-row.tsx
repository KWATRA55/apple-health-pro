import React from 'react'
import { TouchableOpacity, Text } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

const S = {
  dimText: 'rgba(255,255,255,0.40)',
  success: '#30D158',
  warning: '#FFD60A',
  accentCyan: '#00E5FF',
}

export function DataFreshnessRow({
  lastSyncStr,
  statusText = 'Up to date',
  isSyncing = false,
  onPress,
}: {
  lastSyncStr: string;
  statusText?: string;
  isSyncing?: boolean;
  onPress?: () => void;
}) {
  const isWarning = statusText.toLowerCase().includes('partial') || statusText.toLowerCase().includes('missing')
  const iconColor = isSyncing ? S.accentCyan : isWarning ? S.warning : S.success
  const iconName = isSyncing ? 'sync' : isWarning ? 'sync-problem' : 'sync'

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: 0.8 }}
    >
      <MaterialIcons name={iconName as any} size={10} color={iconColor} />
      <Text style={{ color: S.dimText, fontSize: 10, fontWeight: '500' }}>
        {isSyncing ? 'Syncing...' : `Synced ${lastSyncStr}`}
      </Text>
      {!isSyncing && (
        <>
          <Text style={{ color: S.dimText, fontSize: 10 }}>·</Text>
          <Text style={{ color: isWarning ? S.warning : S.dimText, fontSize: 10, fontWeight: '500' }}>
            {statusText}
          </Text>
        </>
      )}
    </TouchableOpacity>
  )
}
