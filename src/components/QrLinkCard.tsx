// src/components/QrLinkCard.tsx — URL共有カード（QR＋URL表示＋コピー）
//
// §3-B（受付設定の公開URL・QR）と§24（設定「PCで作業」）の共用部品。
// QRは読み取り性最優先でテーマ非依存（白地×黒）に固定する。

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import type { ThemeColor } from '../types';

type Props = {
  title: string;
  url: string;
  hint?: string;
  theme: ThemeColor;
  copyLabel: string;
  copiedLabel: string;
};

export function QrLinkCard({ title, url, hint, theme, copyLabel, copiedLabel }: Props) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  }, [url]);

  return (
    <View style={[s.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[s.title, { color: theme.text }]}>{title}</Text>
      <View style={s.qrWrap}>
        <QRCode value={url} size={150} backgroundColor="#FFFFFF" color="#111111" />
      </View>
      <Text style={[s.url, { color: theme.primary }]} selectable>
        {url}
      </Text>
      <TouchableOpacity
        style={[s.copyBtn, { backgroundColor: copied ? '#3BAE5A' : theme.primary }]}
        onPress={() => void handleCopy()}
      >
        <MaterialCommunityIcons name={copied ? 'check' : 'content-copy'} size={16} color="#fff" />
        <Text style={s.copyText}>{copied ? copiedLabel : copyLabel}</Text>
      </TouchableOpacity>
      {hint ? <Text style={[s.hint, { color: theme.subtext }]}>{hint}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 0.5, padding: 16, alignItems: 'center', gap: 10 },
  title: { fontSize: 14, fontWeight: '600', alignSelf: 'flex-start' },
  qrWrap: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 8 },
  url: { fontSize: 12, textAlign: 'center' },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  copyText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
