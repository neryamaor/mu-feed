import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../hooks/useAuth';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    // At the root path "/" (app/index.tsx) the first segment is '' or 'index'.
    const isRoot = !segments[0] || (segments[0] as string) === 'index';

    if (!session) {
      // Not signed in — go to sign in unless already there.
      if (!inAuthGroup) router.replace('/auth/signin');
    } else {
      // Signed in — leave auth screens and the loading index.
      if (inAuthGroup || isRoot) router.replace('/(tabs)/feed');
    }
  }, [session, loading, segments]);

  // GestureHandlerRootView must wrap the entire app for react-native-gesture-handler
  // (Swipeable, etc.) to work. expo-router v6 does not add this automatically.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
