// [CANONICAL] Pure UI component — no health data access.
// Receives messages via props from the Coach tab which sources data
// through the coach RAG pipeline. No canonical selector usage needed here;
// the parent (coach.tsx) is responsible for data provenance.
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
import type { CoachMessage } from '../../lib/types'

// ── STITCH Design Tokens ──────────────────────────────────────────────
const S = {
  surface: '#121214',
  bg: '#000000',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.12)',
  accentCyan: '#00E5FF',
  accentTeal: '#14B8A6',
  accentPurple: '#A855F7',
  glass: 'rgba(255,255,255,0.04)',
  glassHover: 'rgba(255,255,255,0.06)',
  surfaceContainer: '#1C1C1E',
  dimText: 'rgba(255,255,255,0.40)',
  mutedText: 'rgba(255,255,255,0.55)',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  primaryFixedDim: '#7ad7c6',
  secondaryFixedDim: '#c8c2e9',
  error: '#FF453A',
  warning: '#FFD60A',
  success: '#30D158',
}

// ── GlassPanel → EliteCard (V3 canonical component) ───────────────────
import { EliteCard } from '../ui/v3'

function GlassPanel({
  children,
  glowing = false,
  style,
}: {
  children: React.ReactNode
  glowing?: boolean
  style?: any
}) {
  return (
    <EliteCard
      variant={glowing ? 'strong' : 'default'}
      style={[
        glowing && {
          shadowColor: S.primaryFixedDim,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4,
        } as any,
        style,
      ]}
    >
      {children}
    </EliteCard>
  )
}

// ── ChatWindow ─────────────────────────────────────────────────────────
interface ChatWindowProps {
  messages: CoachMessage[]
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null
}

export function ChatWindow({ messages, ListFooterComponent }: ChatWindowProps) {
  const listRef = useRef<FlatList>(null)

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    }
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <GlassPanel glowing style={{ width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Text style={{ color: S.primaryFixedDim, fontSize: 28 }}>🧠</Text>
        </GlassPanel>
        <Text style={{ color: S.onSurface, fontSize: 22, fontWeight: '900', marginBottom: 8, letterSpacing: -0.5 }}>
          Your Health Coach
        </Text>
        <Text style={{ color: S.mutedText, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          Ask me anything about your health, workouts, sleep, or recovery.
        </Text>
      </View>
    )
  }

  return (
    <FlatList
      ref={listRef}
      data={messages}
      keyExtractor={(_, i) => i.toString()}
      style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}
      contentContainerStyle={{ paddingBottom: 16 }}
      renderItem={({ item }) => <MessageBubble message={item} />}
      ListFooterComponent={ListFooterComponent}
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
    />
  )
}

function parseBlocks(text: string) {
  const blocks = text.split('### ').filter(b => b.trim().length > 0)
  if (blocks.length === 0 || text.indexOf('### ') === -1) {
    return [{ title: null, content: text.trim() }]
  }

  return blocks.map(block => {
    const newlineIdx = block.indexOf('\n')
    if (newlineIdx === -1) {
      return { title: block.trim(), content: '' }
    }
    const title = block.substring(0, newlineIdx).trim()
    const content = block.substring(newlineIdx + 1).trim()
    return { title, content }
  })
}

function ParsedMessageBlocks({ text }: { text: string }) {
  const blocks = parseBlocks(text)

  return (
    <View style={{ gap: 8 }}>
      {blocks.map((b, i) => {
        if (!b.title) {
          return (
            <Text key={i} style={{ color: S.onSurface, fontSize: 15, lineHeight: 22 }}>
              {b.content}
            </Text>
          )
        }

        let accent = S.onSurfaceVariant
        let icon = '◆'

        const t = b.title.toUpperCase()
        if (t.includes('SUMMARY')) { accent = S.primaryFixedDim; icon = '⚡' }
        else if (t.includes('WHY')) { accent = S.accentCyan; icon = '🔍' }
        else if (t.includes('ACTION')) { accent = S.accentTeal; icon = '🎯' }
        else if (t.includes('WATCHOUT')) { accent = S.warning; icon = '⚠️' }
        else if (t.includes('CONFIDENCE')) { accent = S.secondaryFixedDim; icon = '📊' }

        return (
          <View key={i} style={{
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: 8,
            padding: 10,
            borderLeftWidth: 2,
            borderLeftColor: accent,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 10 }}>{icon}</Text>
              <Text style={{ color: accent, fontSize: 9, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                {b.title}
              </Text>
            </View>
            <Text style={{ color: S.onSurface, fontSize: 14, lineHeight: 20 }}>
              {b.content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/-/g, '•')}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ── MessageBubble ──────────────────────────────────────────────────────
function MessageBubble({ message }: { message: CoachMessage }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: S.surfaceContainer,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.05)',
            borderRadius: 16,
            borderTopRightRadius: 4,
            paddingHorizontal: 16,
            paddingVertical: 12,
            maxWidth: '85%',
          }}
        >
          <Text style={{ color: S.onSurface, fontSize: 15, lineHeight: 22 }}>
            {message.content}
          </Text>
        </View>
      </View>
    )
  }

  // AI message — glass-panel-glowing style
  return (
    <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-end' }}>
      {/* AI avatar */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: S.accentCyan,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 8,
          marginBottom: 4,
        }}
      >
        <Text style={{ color: '#000', fontSize: 11, fontWeight: '900' }}>AI</Text>
      </View>

      <View
        style={{
          backgroundColor: S.glass,
          borderWidth: 0.5,
          borderColor: 'rgba(122,215,198,0.25)',
          borderRadius: 16,
          borderTopLeftRadius: 4,
          paddingHorizontal: 16,
          paddingVertical: 12,
          maxWidth: '85%',
          shadowColor: S.primaryFixedDim,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 2,
        }}
      >
        {/* Optional status label */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, opacity: 0.7 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: S.primaryFixedDim }} />
          <Text style={{ color: S.onSurfaceVariant, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Analysis
          </Text>
        </View>
        <ParsedMessageBlocks text={message.content} />
      </View>
    </View>
  )
}

// ── ChatInput ──────────────────────────────────────────────────────────
interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  onAttach?: () => void
  isLoading?: boolean
}

export function ChatInput({ onSend, disabled, onAttach, isLoading }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
  }

  const canSend = !disabled && input.trim().length > 0 && !isLoading

  return (
    <View
      style={{
        backgroundColor: 'rgba(18,18,20,0.85)',
        borderWidth: 0.5,
        borderColor: S.borderStrong,
        borderRadius: 28,
        paddingHorizontal: 4,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Attach / Vision button */}
      {onAttach && (
        <TouchableOpacity
          onPress={onAttach}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: S.onSurfaceVariant, fontSize: 22 }}>+</Text>
        </TouchableOpacity>
      )}

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Ask your AI Coach..."
        placeholderTextColor={S.dimText}
        editable={!disabled && !isLoading}
        style={{
          flex: 1,
          color: S.onSurface,
          fontSize: 15,
          paddingHorizontal: 8,
          height: 40,
        }}
        multiline
        maxLength={500}
        onSubmitEditing={handleSend}
        returnKeyType="send"
      />

      {/* Mic placeholder */}
      <TouchableOpacity
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: S.onSurfaceVariant, fontSize: 18 }}>🎤</Text>
      </TouchableOpacity>

      {/* Send button */}
      <TouchableOpacity
        onPress={canSend ? handleSend : undefined}
        disabled={!canSend}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: canSend ? S.primaryFixedDim : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          ...(canSend && {
            shadowColor: S.primaryFixedDim,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          }),
        }}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={S.bg} />
        ) : (
          <Text style={{ color: canSend ? S.bg : S.dimText, fontSize: 16, fontWeight: '900' }}>
            ↑
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}
