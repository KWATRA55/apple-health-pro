import React, { useState } from 'react'
import { View, TextInput, Text, Keyboard, Platform, KeyboardAvoidingView, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

interface AIPromptBarProps {
  onSubmit: (query: string) => void
  isLoading?: boolean
  placeholder?: string
}

// [CANONICAL] Pure UI component — no health data access. Scope: N/A
export const AIPromptBar = React.memo(function AIPromptBar({
  onSubmit,
  isLoading = false,
  placeholder = 'Ask KILO...',
}: AIPromptBarProps) {
  const [input, setInput] = useState('')

  const handleSubmit = () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return
    onSubmit(trimmed)
    setInput('')
    Keyboard.dismiss()
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 50,
        bottom: 96,
      }}
    >
      <View
        style={{
          borderRadius: 9999,
          backgroundColor: 'rgba(18, 18, 20, 0.8)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.6,
          shadowRadius: 24,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          {/* Icon */}
          <MaterialIcons name="auto-awesome" size={20} color="#00E5FF" />

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={placeholder}
            placeholderTextColor="rgba(189,201,197,0.7)"
            editable={!isLoading}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            style={{
              flex: 1,
              marginLeft: 12,
              color: '#e2e2e2',
              fontSize: 16,
              fontStyle: input ? 'normal' : 'italic',
              fontWeight: '400',
              height: 40,
            }}
            maxLength={300}
          />
          <TouchableOpacity
            onPress={input.trim() ? handleSubmit : undefined}
            disabled={isLoading}
            style={{
              marginLeft: 8,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialIcons name={input.trim() ? "send" : "mic"} size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
})
