import React from 'react'
import { View, Text } from 'react-native'

interface WeeklyChecklistProps {
  status: boolean[]
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// [CANONICAL-TODO] This component receives journal completion status via props.
// Parent should derive status from journal entries queried via canonical selectors.
export function JournalWeeklyChecklist({ status }: WeeklyChecklistProps) {
  return (
    <View className="flex-row justify-between w-full mt-4">
      {DAYS.map((day, i) => {
        const isChecked = status[i]
        return (
          <View key={i} className="items-center">
            <View
              className={`w-7 h-7 rounded-full items-center justify-center border ${isChecked
                  ? 'bg-accent-volt border-accent-volt'
                  : 'bg-transparent border-border-dim'
                }`}
              style={isChecked ? {
                shadowColor: '#CCFF00',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 6,
                elevation: 6,
              } : {}}
            >
              {isChecked && (
                <Text className="text-inverse text-[11px] font-black">✓</Text>
              )}
            </View>
            <Text className="text-[9px] text-smoke mt-1.5 font-bold">{day}</Text>
          </View>
        )
      })}
    </View>
  )
}
