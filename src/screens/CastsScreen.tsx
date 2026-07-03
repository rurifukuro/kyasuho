import React from 'react';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';

// §3-C キャスト管理（登録/出勤/指名ON・OFF）。Rev2 は器のみ。
export function CastsScreen() {
  return (
    <PlaceholderScreen
      icon="account-star"
      titleKey="placeholder.casts.title"
      descKey="placeholder.casts.desc"
    />
  );
}
