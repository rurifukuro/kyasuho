import React from 'react';
import { Modal, View, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardDoneBar } from '../KeyboardDoneBar';
import type { ThemeColor } from '../../types';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  theme: ThemeColor;
  children: React.ReactNode;
};

export function FormModalShell({ visible, onRequestClose, theme, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onRequestClose}
      statusBarTranslucent={true}
    >
      <View style={{ flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : insets.top, backgroundColor: theme.background }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {children}
        </KeyboardAvoidingView>
        <KeyboardDoneBar theme={theme} />
      </View>
    </Modal>
  );
}
