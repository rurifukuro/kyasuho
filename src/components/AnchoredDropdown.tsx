import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
} from 'react-native';
import type { ThemeColor } from '../types';

export type DropOption = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

type Props = {
  label: string;
  valueLabel: string;
  isPlaceholder?: boolean;
  disabled?: boolean;
  options: DropOption[];
  theme: ThemeColor;
};

export function AnchoredDropdown({ label, valueLabel, isPlaceholder, disabled, options, theme }: Props) {
  const btnRef = useRef<View>(null);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number } | null>(null);
  const [open, setOpen] = useState(false);

  const openDropdown = () => {
    if (disabled) return;
    btnRef.current?.measure((_fx, _fy, width, height, px, py) => {
      setLayout({ x: px, y: py + height, width });
      setOpen(true);
    });
  };

  return (
    <>
      <Text style={[s.label, { color: theme.subtext }]}>{label}</Text>
      <View ref={btnRef} collapsable={false}>
        <TouchableOpacity
          style={[s.dropdownBtn, { borderColor: theme.border, backgroundColor: theme.card, opacity: disabled ? 0.5 : 1 }]}
          onPress={openDropdown}
          disabled={disabled}
          activeOpacity={0.8}
        >
          <Text
            style={[s.dropdownBtnText, { color: isPlaceholder ? theme.subtext : theme.text }]}
            numberOfLines={1}
          >
            {valueLabel}
          </Text>
          <Text style={[s.dropdownArrow, { color: theme.subtext }]}>▼</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)}>
          {layout && (
            <View
              style={[s.dropdownList, {
                left: layout.x, top: layout.y, minWidth: layout.width,
                backgroundColor: theme.card, borderColor: theme.border,
              }]}
            >
              <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
                {options.map((o) => (
                  <TouchableOpacity
                    key={o.key}
                    style={[s.dropdownItem, o.active && { backgroundColor: theme.primary + '20' }]}
                    onPress={() => { o.onPress(); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[s.dropdownItemText, { color: o.active ? theme.primary : theme.text }]}
                      numberOfLines={1}
                    >
                      {o.label}
                    </Text>
                    {o.active && <Text style={[s.dropdownCheckmark, { color: theme.primary }]}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 11, marginTop: 6, marginBottom: 2 },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4,
  },
  dropdownBtnText: { fontSize: 14, fontWeight: '600', flex: 1 },
  dropdownArrow: { fontSize: 11, marginLeft: 6 },
  dropdownList: {
    position: 'absolute', borderWidth: 1, borderRadius: 10, overflow: 'hidden', maxHeight: 340,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownItemText: { fontSize: 14, fontWeight: '500', flex: 1 },
  dropdownCheckmark: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
});
