import { Alert } from 'react-native';
import { findBannedWord } from '../config/contentFilter';
import type { TKey } from '../i18n';

type TFunc = (key: TKey, params?: Record<string, string>) => string;

export function guardText(text: string, fieldLabel: string, t: TFunc): boolean {
  const hit = findBannedWord(text);
  if (!hit) return true;
  Alert.alert(t('filter.blockedTitle'), t('filter.blockedBody'));
  return false;
}

export function guardFields(
  fields: Record<string, string | undefined>,
  t: TFunc,
): boolean {
  for (const v of Object.values(fields)) {
    if (v && findBannedWord(v)) {
      Alert.alert(t('filter.blockedTitle'), t('filter.blockedBody'));
      return false;
    }
  }
  return true;
}
