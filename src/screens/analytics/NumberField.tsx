// src/screens/analytics/NumberField.tsx — 数値入力欄（売上・給与フォーム共用）
//
// state は文字列で持ち、数字以外を弾く。確定時は Number(value) || 0 で読む。

import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import type { ThemeColor } from '../../types';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  theme: ThemeColor;
};

export function NumberField({ label, value, onChange, theme }: Props) {
  return (
    <>
      <Text style={[nf.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        style={[nf.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={theme.subtext}
      />
    </>
  );
}

/** 入力文字列 → 数値（空・不正は0）。 */
export function parseNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const nf = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
});
