// Settings screen — accessed via the gear icon on the profile screen.
// Stack push within the profile tab; no new tab created.
//
// Contains:
//   - אודות MuFeed (static about paragraph)
//   - זכויות יוצרים וחוק (navigates to existing copyright screen)
//   - התנתקות (sign out)
//   - Version number (static)

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      // Root layout (_layout.tsx) detects the cleared session and redirects to sign in.
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Navigation header */}
      <View style={styles.navHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#6b7280" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>הגדרות</Text>
        <View style={styles.navSpacer} />
      </View>

      {/* About section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>אודות MuFeed</Text>
        <Text style={styles.aboutText}>
          MuFeed היא אפליקציה ללימוד ערבית מדוברת פלסטינית דרך סרטונים קצרים.
          כל סרטון מלווה בכתוביות אינטראקטיביות — הקש על מילה כדי לראות תרגום
          ולשמור אותה למילון האישי שלך.
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Copyright */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push('/profile/copyright')}
      >
        <Ionicons name="chevron-back" size={18} color="#d1d5db" />
        <Text style={styles.rowLabel}>זכויות יוצרים וחוק</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Sign out */}
      <TouchableOpacity
        style={[styles.row, signingOut && styles.rowDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color="#dc2626" style={styles.signOutLoader} />
        ) : (
          <Text style={styles.signOutLabel}>התנתקות</Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Version */}
      <Text style={styles.version}>גרסה 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 32,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  navSpacer: {
    width: 32,
  },
  // ── About ──
  section: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    textAlign: 'right',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  aboutText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'right',
    lineHeight: 24,
  },
  // ── List rows ──
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowLabel: {
    fontSize: 16,
    color: '#374151',
    marginRight: 8,
  },
  signOutLabel: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '600',
  },
  signOutLoader: {
    marginVertical: 2,
  },
  // ── Version ──
  version: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
