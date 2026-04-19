import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { getUserFavorites } from '../../../services/favorites';

export default function ProfileScreen() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [favCount, setFavCount] = useState<number | null>(null);

  // Reload count whenever the tab comes into focus (user may have unfavorited from feed).
  useFocusEffect(
    useCallback(() => {
      getUserFavorites()
        .then((favs) => setFavCount(favs.length))
        .catch(() => setFavCount(0));
    }, []),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Header row: email + gear icon */}
      <View style={styles.headerRow}>
        <Text style={styles.email}>{user?.email}</Text>
        <TouchableOpacity
          style={styles.gearButton}
          onPress={() => router.push('/profile/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* Admin entry point — only rendered for users with admin_permissions */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push('/admin/upload')}
        >
          <Text style={styles.adminButtonText}>Admin Panel</Text>
        </TouchableOpacity>
      )}

      {/* ── Favorites row ──────────────────────────────────────────────────── */}
      <TouchableOpacity
        style={styles.navRow}
        onPress={() => router.push('/profile/favorites')}
        activeOpacity={0.7}
      >
        <View style={styles.navRowLeft}>
          <Text style={styles.navRowLabel}>הסרטונים המועדפים שלי</Text>
          {favCount !== null && (
            <Text style={styles.navRowCount}>({favCount} סרטונים)</Text>
          )}
        </View>
        <Ionicons name="chevron-back" size={18} color="#d1d5db" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  email: {
    fontSize: 16,
    color: '#6b7280',
    flex: 1,
    textAlign: 'right',
  },
  gearButton: {
    marginLeft: 12,
  },
  adminButton: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  adminButtonText: {
    color: '#1a1a1a',
    fontWeight: '600',
    fontSize: 16,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  navRowLabel: {
    fontSize: 16,
    color: '#111',
    textAlign: 'right',
  },
  navRowCount: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
