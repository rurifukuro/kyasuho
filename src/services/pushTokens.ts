import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from '../config/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export async function savePushToken(tenantId: string, userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('ky_push_tokens')
    .upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        token,
        platform: Platform.OS,
      },
      { onConflict: 'user_id,token' },
    );
  if (error) console.warn('[kyasuho] savePushToken:', error);
}

export async function removePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('ky_push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token);
  if (error) console.warn('[kyasuho] removePushToken:', error);
}
