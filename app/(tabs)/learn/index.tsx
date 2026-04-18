// Learn tab — two sub-sections accessed via a segmented control at the top:
//   - מילון גלובלי (Global Dictionary) — placeholder until Task 2.5
//   - דקדוק       (Grammar Rules)       — placeholder until Task 2.3

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Section = 'dictionary' | 'grammar';

export default function LearnScreen() {
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('dictionary');

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      {/* Segmented control */}
      <View style={styles.segmentRow}>
        <Pressable
          style={[styles.segment, section === 'dictionary' && styles.segmentActive]}
          onPress={() => setSection('dictionary')}
        >
          <Text style={[styles.segmentText, section === 'dictionary' && styles.segmentTextActive]}>
            מילון גלובלי
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segment, section === 'grammar' && styles.segmentActive]}
          onPress={() => setSection('grammar')}
        >
          <Text style={[styles.segmentText, section === 'grammar' && styles.segmentTextActive]}>
            דקדוק
          </Text>
        </Pressable>
      </View>

      {/* Section content */}
      {section === 'dictionary' ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>מילון גלובלי</Text>
          <Text style={styles.placeholderBody}>
            בקרוב — מילון כולל כל המילים מהסרטונים
          </Text>
        </View>
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>דקדוק</Text>
          <Text style={styles.placeholderBody}>
            בקרוב — כללי תחביר ודקדוק
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  segmentRow: {
    flexDirection: 'row-reverse',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#2563eb',
  },
  segmentText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: '#fff',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  placeholderTitle: {
    color: '#4b5563',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  placeholderBody: {
    color: '#374151',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
