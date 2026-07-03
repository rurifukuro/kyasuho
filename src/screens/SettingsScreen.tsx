import React from 'react';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';

// §3-G 設定・アカウント（Auth/削除/規約/PP/通報/IAP/言語/テーマ）。Rev2 は器のみ。
export function SettingsScreen() {
  return (
    <PlaceholderScreen
      icon="cog"
      titleKey="placeholder.settings.title"
      descKey="placeholder.settings.desc"
    />
  );
}
