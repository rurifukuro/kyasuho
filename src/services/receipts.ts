import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../config/supabase';
import { decode } from 'base64-arraybuffer';

const BUCKET = 'ky-receipts';
const MAX_LONG_SIDE = 1200;

async function resizeImage(uri: string): Promise<{ base64: string; mimeType: string }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_LONG_SIDE } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return { base64: result.base64!, mimeType: 'image/jpeg' };
}

async function uploadAndLink(
  tenantId: string,
  expenseId: string,
  uri: string,
): Promise<string> {
  const { base64, mimeType } = await resizeImage(uri);
  const path = `${tenantId}/${expenseId}.jpg`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(base64), { contentType: mimeType, upsert: true });
  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

  const { error: dbErr } = await supabase
    .from('ky_expenses')
    .update({ receipt_url: publicUrl })
    .eq('id', expenseId);
  if (dbErr) throw dbErr;

  return publicUrl;
}

export async function pickReceiptFromGallery(
  tenantId: string,
  expenseId: string,
): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  return uploadAndLink(tenantId, expenseId, result.assets[0].uri);
}

export async function takeReceiptPhoto(
  tenantId: string,
  expenseId: string,
): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.9,
  });
  if (result.canceled || !result.assets[0]) return null;

  return uploadAndLink(tenantId, expenseId, result.assets[0].uri);
}

export async function deleteReceipt(
  tenantId: string,
  expenseId: string,
): Promise<void> {
  const path = `${tenantId}/${expenseId}.jpg`;
  await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await supabase
    .from('ky_expenses')
    .update({ receipt_url: null })
    .eq('id', expenseId);
  if (error) throw error;
}
