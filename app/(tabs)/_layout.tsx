import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// Tab order (right → left for RTL layout):
//   פרופיל | מילון | לימוד | חיפוש | פיד
//
// In Expo Router 6, folders without a _layout.tsx are registered as
// "folder/index" (not "folder"). profile/ has a _layout.tsx so it's
// just "profile". All other tabs use the "folder/index" name.
//
// Flashcards is hidden from the tab bar — accessed from inside the מילון tab.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: { backgroundColor: '#111' },
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{
          title: 'פרופיל',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dictionary/index"
        options={{
          title: 'מילון',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn/index"
        options={{
          title: 'לימוד',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: 'חיפוש',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed/index"
        options={{
          title: 'פיד',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="flashcards/index" options={{ href: null }} />
    </Tabs>
  );
}
