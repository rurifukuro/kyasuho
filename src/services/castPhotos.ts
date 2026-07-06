import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../config/supabase';
import { decode } from 'base64-arraybuffer';

const BUCKET = 'ky-cast-photos';
const MAX_LONG_SIDE = 840;

async function resizeImage(uri: string): Promise<{ base64: string; mimeType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_LONG_SIDE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { base64: result.base64!, mimeType: 'image/jpeg' };
}

export async function pickAndUploadShopPhoto(
  tenantId: string,
  castId: string,
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  const { base64, mimeType } = await resizeImage(result.assets[0].uri);
  const path = `${tenantId}/${castId}/shop.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), {
      contentType: mimeType,
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await supabase.from('ky_casts').update({ photo_url: publicUrl }).eq('id', castId);
  return publicUrl;
}

export async function pickAndUploadIdPhoto(
  tenantId: string,
  castId: string,
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  const { base64, mimeType } = await resizeImage(result.assets[0].uri);
  const path = `${tenantId}/${castId}/id.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), {
      contentType: mimeType,
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  await supabase.from('ky_cast_profiles').update({ id_photo_url: publicUrl }).eq('cast_id', castId);
  return publicUrl;
}

export async function deleteShopPhoto(tenantId: string, castId: string): Promise<void> {
  const path = `${tenantId}/${castId}/shop.jpg`;
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from('ky_casts').update({ photo_url: null }).eq('id', castId);
}

export async function deleteIdPhoto(tenantId: string, castId: string): Promise<void> {
  const path = `${tenantId}/${castId}/id.jpg`;
  await supabase.storage.from(BUCKET).remove([path]);
  await supabase.from('ky_cast_profiles').update({ id_photo_url: null }).eq('cast_id', castId);
}
