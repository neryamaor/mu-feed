import { View, ActivityIndicator } from 'react-native';

// Root entry point. Shown briefly while _layout.tsx resolves the auth session
// and redirects to either /auth/signin or /(tabs)/feed.
export default function IndexScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1a1a1a" />
    </View>
  );
}
