import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { MaterialIcons } from '@expo/vector-icons'

// ── Props ────────────────────────────────────────────────────────────────────

interface BiometricsInfoModalProps {
  visible: boolean
  onClose: () => void
  initialTab?: 'pillars' | 'glossary'
}

// ── Stitch Design Tokens ─────────────────────────────────────────────────────

const S = {
  bg: 'rgba(0, 0, 0, 0.92)',
  surface: '#121214',
  surfaceContainer: '#1C1C1E',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.15)',
  accentCyan: '#00E5FF',
  accentTeal: '#14B8A6',
  accentPurple: '#A855F7',
  onSurface: '#FAFAFA',
  onSurfaceVariant: '#bdc9c5',
  dimText: 'rgba(255, 255, 255, 0.40)',
  mutedText: 'rgba(255, 255, 255, 0.55)',
  success: '#30D158',
  warning: '#FFD60A',
  error: '#FF453A',
}

export function BiometricsInfoModal({ visible, onClose, initialTab = 'pillars' }: BiometricsInfoModalProps) {
  const [activeTab, setActiveTab] = useState<'pillars' | 'glossary'>(initialTab)
  
  // Reanimated values for modal entrance
  const overlayOpacity = useSharedValue(0)
  const scale = useSharedValue(0.95)
  const translateY = useSharedValue(50)

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab)
      overlayOpacity.value = withTiming(1, { duration: 300 })
      scale.value = withSpring(1, { damping: 18, stiffness: 150 })
      translateY.value = withSpring(0, { damping: 18, stiffness: 150 })
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    } else {
      overlayOpacity.value = withTiming(0, { duration: 250 })
      scale.value = withTiming(0.95, { duration: 200 })
      translateY.value = withTiming(50, { duration: 200 })
    }
  }, [visible])

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }))

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
  }))

  if (!visible) return null

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
  }

  const selectTab = (tab: 'pillars' | 'glossary') => {
    Haptics.selectionAsync()
    setActiveTab(tab)
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.fullscreen}>
        {/* Semi-transparent backdrop tap-to-dismiss */}
        <Animated.View style={[styles.backdrop, overlayStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        </Animated.View>

        {/* Modal Container */}
        <Animated.View style={[styles.modalContainer, containerStyle]}>
          
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.superTitle}>Elite Science Core</Text>
              <Text style={styles.mainTitle}>Biometrics Guide</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
              <MaterialIcons name="close" size={20} color={S.onSurface} />
            </TouchableOpacity>
          </View>

          {/* Segmented Tab Control */}
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'pillars' && styles.tabButtonActive]} 
              onPress={() => selectTab('pillars')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'pillars' && styles.tabTextActive]}>
                The 3 Pillars
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabButton, activeTab === 'glossary' && styles.tabButtonActive]} 
              onPress={() => selectTab('glossary')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'glossary' && styles.tabTextActive]}>
                Glossary
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Content Area */}
          <ScrollView 
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {activeTab === 'pillars' ? (
              <View style={styles.tabContent}>
                
                {/* Science Explainer Box */}
                <View style={styles.scienceExplanationBox}>
                  <Text style={styles.scienceExplanationHeading}>Why is Longevity 90% while Readiness is 25%?</Text>
                  <Text style={styles.scienceExplanationText}>
                    A common point of confusion is seeing a stable, highly robust <Text style={{color: S.accentCyan, fontWeight: '700'}}>Longevity score (e.g. 90%)</Text> even when your immediate <Text style={{color: S.accentTeal, fontWeight: '700'}}>Readiness (25% Depleted)</Text> or <Text style={{color: S.accentPurple, fontWeight: '700'}}>Resilience (50% Guarded)</Text> scores have crashed.
                  </Text>
                  <Text style={styles.scienceExplanationText}>
                    This is by design. Your body operates on different timescales:
                  </Text>
                </View>

                {/* Pillar 1: Readiness */}
                <View style={[styles.pillarCard, { borderColor: `${S.accentTeal}25` }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>◉</Text>
                    <Text style={[styles.pillarTitle, { color: S.accentTeal }]}>Readiness (Acute / 24h)</Text>
                    <View style={[styles.timescaleBadge, { backgroundColor: 'rgba(20, 184, 166, 0.15)' }]}>
                      <Text style={[styles.timescaleText, { color: S.accentTeal }]}>Daily</Text>
                    </View>
                  </View>
                  <Text style={styles.pillarDescription}>
                    Governed by your autonomic nervous system reserve. Fluctuates rapidly based on HRV, resting heart rate (RHR), and sleep debt. It shows if you are primed to train hard <Text style={{fontWeight: '700'}}>today</Text>, but tells us very little about long-term structural health.
                  </Text>
                </View>

                {/* Pillar 2: Resilience */}
                <View style={[styles.pillarCard, { borderColor: `${S.accentPurple}25` }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>◆</Text>
                    <Text style={[styles.pillarTitle, { color: S.accentPurple }]}>Resilience (Short-term / Weekly)</Text>
                    <View style={[styles.timescaleBadge, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                      <Text style={[styles.timescaleText, { color: S.accentPurple }]}>Weekly</Text>
                    </View>
                  </View>
                  <Text style={styles.pillarDescription}>
                    Governed by your immunological, biomechanical, and central nervous system load. It captures short-term fatigue from workouts, minor inflammation, daylight deficits, or auditory stress. It represents your current defensive shield.
                  </Text>
                </View>

                {/* Pillar 3: Longevity */}
                <View style={[styles.pillarCard, { borderColor: `${S.accentCyan}25` }]}>
                  <View style={styles.pillarHeader}>
                    <Text style={{ fontSize: 20, marginRight: 8 }}>●</Text>
                    <Text style={[styles.pillarTitle, { color: S.accentCyan }]}>Longevity (Long-term / Structural)</Text>
                    <View style={[styles.timescaleBadge, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
                      <Text style={[styles.timescaleText, { color: S.accentCyan }]}>Months/Years</Text>
                    </View>
                  </View>
                  <Text style={styles.pillarDescription}>
                    Your structural baseline. Built on heavy cellular aging parameters, gait stability symmetry (Double Support), VO2 Max, and your Biological Age relative to Chronological Age. Structural changes are stable and slow. <Text style={{fontWeight: '700'}}>A single bad night or heavy training day will not crash your structural longevity.</Text>
                  </Text>
                </View>

              </View>
            ) : (
              <View style={styles.tabContent}>
                
                {/* Glossary Items */}
                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>HRV (Heart Rate Variability)</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentTeal }]}>Readiness</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    The millisecond variation between consecutive heartbeats. Controlled by your autonomic nervous system. A higher HRV relative to baseline indicates high parasympathetic (recovery) dominance, while a depressed HRV points to acute autonomic stress.
                  </Text>
                </View>

                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>RHR (Resting Heart Rate)</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentTeal }]}>Readiness</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    The lowest number of beats per minute when fully relaxed. A rising RHR indicates that your cardiovascular system is working harder than usual, signaling impending illness, sleep deficit, or high physical stress.
                  </Text>
                </View>

                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>CNS Stress (Central Nervous System Fatigue)</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentPurple }]}>Resilience</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    A synthesis of neurological tiredness. Calculated by analyzing acute suppression of HRV, excessive environmental headphone audio exposure (auditory stress), sleep deprivation, and daylight deficits. High CNS stress impairs muscular power and reflexes.
                  </Text>
                </View>

                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>Skin Temp Delta</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentPurple }]}>Resilience</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    The deviation of sleep skin temperature from your 14-day baseline. Significant positive deviations (+0.5°C or higher) indicate micro-inflammation, immunological activation (fighting infection), or poor sleep thermal environments.
                  </Text>
                </View>

                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>VO2 Max (Maximal Oxygen Uptake)</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentCyan }]}>Longevity</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    The maximum volume of oxygen your body can utilize during intense exercise. Universally recognized as the strongest single independent metric of cardiovascular fitness and aerobic capacity, making it a critical biomarker of all-cause mortality and longevity.
                  </Text>
                </View>

                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>Double Support (Gait Stability Index)</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentCyan }]}>Longevity</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    The percentage of time during a walk when both feet are on the ground. A stable gait and optimal balance minimize neuromuscular aging and injury risk. Stable support percentage represents neuromuscular alignment and skeletal robustness.
                  </Text>
                </View>

                <View style={styles.glossaryItem}>
                  <View style={styles.glossaryHeader}>
                    <Text style={styles.glossaryTerm}>Pace of Aging / Biological Age</Text>
                    <Text style={[styles.glossaryPillarTag, { color: S.accentCyan }]}>Longevity</Text>
                  </View>
                  <Text style={styles.glossaryDefinition}>
                    Calculated cellular decay rates. A Pace of Aging of 0.85x means you are biologically aging 15% slower than chronological time. Decoupled from daily fatigue, this slow-moving structural metric measures cellular age based on metabolic health, mobility indices, and VO2 Max.
                  </Text>
                </View>

              </View>
            )}
          </ScrollView>

          {/* Action Bottom Section */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.bottomBarButton} onPress={handleClose} activeOpacity={0.8}>
              <Text style={styles.bottomBarButtonText}>UNDERSTOOD</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: S.bg,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '82%',
    backgroundColor: S.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: S.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    shadowOpacity: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: S.border,
  },
  superTitle: {
    color: S.accentCyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  mainTitle: {
    color: S.onSurface,
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: S.borderStrong,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 3,
    borderWidth: 0.5,
    borderColor: S.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 0.5,
    borderColor: S.borderStrong,
  },
  tabText: {
    color: S.dimText,
    fontSize: 13,
    fontWeight: '700',
  },
  tabTextActive: {
    color: S.onSurface,
    fontWeight: '800',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  tabContent: {
    gap: 16,
    paddingTop: 8,
  },
  scienceExplanationBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 0.5,
    borderColor: S.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
  },
  scienceExplanationHeading: {
    color: S.onSurface,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  scienceExplanationText: {
    color: S.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    marginBottom: 8,
  },
  pillarCard: {
    borderWidth: 0.5,
    borderRadius: 14,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
  },
  pillarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pillarTitle: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  timescaleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timescaleText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillarDescription: {
    color: S.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  glossaryItem: {
    borderBottomWidth: 0.5,
    borderBottomColor: S.border,
    paddingVertical: 14,
  },
  glossaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  glossaryTerm: {
    color: S.onSurface,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  glossaryPillarTag: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  glossaryDefinition: {
    color: S.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 0.5,
    borderTopColor: S.border,
  },
  bottomBarButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 0.5,
    borderColor: S.borderStrong,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  bottomBarButtonText: {
    color: S.onSurface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
})
