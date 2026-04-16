import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';

export default function ProfileScreen() {
  const { user, isAdmin, signOut } = useAuth();
  const router = useRouter();
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
    <View style={styles.container}>
      <Text style={styles.email}>{user?.email}</Text>

      {/* Admin entry point — only rendered for users with admin_permissions */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.adminButton}
          onPress={() => router.push('/admin/upload')}
        >
          <Text style={styles.adminButtonText}>Admin Panel</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.signOutButton, signingOut && styles.buttonDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color="#1a1a1a" />
        ) : (
          <Text style={styles.signOutText}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  email: { fontSize: 16, color: '#6b7280', marginTop: 48, marginBottom: 32 },
  adminButton: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  adminButtonText: { color: '#1a1a1a', fontWeight: '600', fontSize: 16 },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  signOutText: { color: '#6b7280', fontWeight: '600', fontSize: 16 },
});
