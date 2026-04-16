import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    // Silently redirect non-admins. No error message — the admin area simply
    // does not exist for users without a row in admin_permissions.
    if (!isAdmin) {
      router.replace('/(tabs)/feed');
    }
  }, [isAdmin, loading]);

  // Render nothing while loading or if the user is not an admin.
  // This prevents any admin UI from flashing before the redirect fires.
  if (loading || !isAdmin) return null;

  return <Stack screenOptions={{ headerShown: false }} />;
}
