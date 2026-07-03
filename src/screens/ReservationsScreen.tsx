import React from 'react';
import { PlaceholderScreen } from '../components/common/PlaceholderScreen';

// §3-A 予約台帳（コア）。Rev2 は器のみ。
export function ReservationsScreen() {
  return (
    <PlaceholderScreen
      icon="calendar-check"
      titleKey="placeholder.reservations.title"
      descKey="placeholder.reservations.desc"
    />
  );
}
