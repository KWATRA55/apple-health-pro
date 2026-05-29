import React from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'

const S = {
  surface: '#121214',
  border: 'rgba(255,255,255,0.08)',
  onSurface: '#FAFAFA',
  dimText: 'rgba(255,255,255,0.40)',
}

type ExplainSheetProps = {
  visible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function ExplainSheet({ visible, onClose, title, subtitle, children }: ExplainSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <TouchableOpacity 
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
            activeOpacity={1} 
            onPress={onClose}
          >
            <BlurView intensity={20} tint="dark" style={{ flex: 1 }} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.duration(250)}
          style={{
            backgroundColor: S.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 8,
            paddingBottom: 48,
            borderWidth: 0.5,
            borderColor: S.border,
            borderBottomWidth: 0,
            maxHeight: '85%',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: S.border }} />
          </View>
          
          <View style={{ paddingHorizontal: 24, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Text style={{ color: S.onSurface, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>
                {title}
              </Text>
              {subtitle && (
                <Text style={{ color: S.dimText, fontSize: 13, marginTop: 4 }}>
                  {subtitle}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <MaterialIcons name="close" size={24} color={S.dimText} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
            {children}
            <View style={{ height: 24 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}
