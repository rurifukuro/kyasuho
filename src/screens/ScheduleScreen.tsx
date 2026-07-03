import React from 'react';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';

// §3-B 受付設定（営業日/席/解禁・〆切/公開URL）。Rev2 は器のみ。
export function ScheduleScreen() {
  return (
    <PlaceholderScreen
      icon="clock-edit"
      titleKey="placeholder.schedule.title"
      descKey="placeholder.schedule.desc"
    />
  );
}
