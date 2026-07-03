import React, { useState, useEffect } from 'react';
import { Keyboard, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../context/LanguageContext';
import type { ThemeColor } from '../types';

/**
 * キーボード表示中、その直上・右端に出す「完了」フローティングボタン（とれはんっ！流用）。
 * InputAccessoryView ではなく Keyboard.addListener を使うため Modal 内でも正しく動く。
 *
 * ── マウント鉄則（メモリ厳命）──
 *   必ず KeyboardAvoidingView の「外＝兄弟」に置く。KAV の内側に入れると二重カウントで
 *   iOS のみボタンが浮く（Android エミュでは露見しない）。
 *
 * ── 配置式（Platform 分岐・screen-bottom 基準）──
 *   iOS    : bottom = kbHeight + 2 + bottomOffset
 *            endCoordinates.height は QuickType 込み・ホームインジケータ高は kbHeight 外。
 *            `+ insets.bottom` を足すと浮きすぎる。
 *   Android: bottom = kbHeight + insets.bottom + 2 + bottomOffset
 *            Expo Go SDK54 では resize が不発で window.height==screen.height のため
 *            画面下端〜キーボード上端の絶対距離 = kbHeight + insets.bottom。
 *
 * 背景色は標準グレー #8E8E93 で固定（テーマ primary にしない＝メモリ厳命）。
 */
export function KeyboardDoneBar({
  theme,
  bottomOffset = 0,
  extraBottomRetreat = 0,
}: {
  theme: ThemeColor;
  bottomOffset?: number;
  extraBottomRetreat?: number;
}) {
  const [kbHeight, setKbHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (kbHeight === 0) return null;

  const bottomPx =
    Platform.OS === 'android'
      ? Math.max(0, kbHeight - extraBottomRetreat) + insets.bottom + 2 + bottomOffset
      : Math.max(0, kbHeight - extraBottomRetreat) + 2 + bottomOffset;

  return (
    <TouchableOpacity
      style={[s.btn, { bottom: bottomPx, backgroundColor: '#8E8E93' }]}
      onPress={Keyboard.dismiss}
      activeOpacity={0.85}
    >
      <Text style={s.btnText}>{t('common.kbdDone')}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    position: 'absolute',
    right: 14,
    zIndex: 999,
    elevation: 10,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
