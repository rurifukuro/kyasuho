// src/components/HelpChatModal.tsx — Q&A AIアシスタント チャットモーダル（SPEC §46）
//
// ・FormModalShell（MODAL-SAFE）＝上部inset＋KAV＋KeyboardDoneBar は shell 側で統一
//   （下端入力バーの退避は iOS=shell内KAV(padding) / Android=app.json softwareKeyboardLayoutMode:"resize"。
//    ルールO-4 の手動リスナーは本アプリの確立構成では不要と判断。実機で隠れる場合はO-4式へ切替）
// ・履歴は端末セッション内のみ（モーダルを閉じても保持・アプリ終了で消える＝サーバー保存しない）
// ・context プロップ: 呼び出し元画面の状況（例: プリンター設定ウィザードのステップ）を初回質問に添付
// ・フッター固定注記＋ContactFormModal導線（§46: 行き止まり禁止＝WEB6と同趣旨）

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FormModalShell } from './common/FormModalShell';
import ContactFormModal from './ContactFormModal';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { askFaqAi, FaqChatMessage } from '../services/faqAi';

type Props = {
  visible: boolean;
  onClose: () => void;
  context?: string;
};

export function HelpChatModal({ visible, onClose, context }: Props) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<FaqChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const handleSend = useCallback(async () => {
    const question = input.trim();
    if (!question || loading) return;
    const history = messages;
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);
    scrollToEnd();
    try {
      // context は会話の最初の質問にだけ添付（以降は履歴で文脈が伝わる）
      const result = await askFaqAi(question, history, history.length === 0 ? context : undefined);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.answer }]);
    } catch (e) {
      const msg =
        e instanceof Error && e.message === 'daily_limit_exceeded'
          ? t('faq.limitReached')
          : t('faq.error');
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  }, [input, loading, messages, context, t, scrollToEnd]);

  return (
    <FormModalShell visible={visible} onRequestClose={onClose} theme={theme}>
      {/* ヘッダー */}
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <MaterialCommunityIcons name="robot-happy-outline" size={22} color={theme.primary} />
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('faq.title')}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="close" size={24} color={theme.subtext} />
        </TouchableOpacity>
      </View>

      {/* メッセージログ */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={s.logContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[s.bubble, s.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[s.bubbleText, { color: theme.text }]}>{t('faq.welcome')}</Text>
        </View>
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <View key={i} style={[s.bubble, s.bubbleUser, { backgroundColor: theme.primary }]}>
              <Text style={[s.bubbleText, { color: '#fff' }]}>{m.content}</Text>
            </View>
          ) : (
            <View
              key={i}
              style={[s.bubble, s.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={[s.bubbleText, { color: theme.text }]}>{m.content}</Text>
            </View>
          ),
        )}
        {loading && (
          <View style={[s.bubble, s.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={s.thinkingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[s.bubbleText, { color: theme.subtext }]}>{t('faq.thinking')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 固定注記＋お問い合わせ導線 */}
      <View style={[s.disclaimer, { borderTopColor: theme.border }]}>
        <Text style={[s.disclaimerText, { color: theme.subtext }]}>{t('faq.disclaimer')}</Text>
        <TouchableOpacity onPress={() => setShowContact(true)}>
          <Text style={[s.contactLink, { color: theme.primary }]}>{t('faq.contactLink')}</Text>
        </TouchableOpacity>
      </View>

      {/* 入力バー（BOTTOM-MARGIN: idle時 insets.bottom+8） */}
      <View style={[s.inputBar, { paddingBottom: insets.bottom + 8, borderTopColor: theme.border }]}>
        <TextInput
          style={[s.input, { color: theme.text, backgroundColor: theme.card, borderColor: theme.border }]}
          value={input}
          onChangeText={setInput}
          placeholder={t('faq.inputPlaceholder')}
          placeholderTextColor={theme.subtext}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[s.sendButton, { backgroundColor: input.trim() && !loading ? theme.primary : theme.border }]}
          onPress={handleSend}
          disabled={!input.trim() || loading}
        >
          <MaterialCommunityIcons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ContactFormModal visible={showContact} onClose={() => setShowContact(false)} />
    </FormModalShell>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600' },
  logContent: { padding: 16, gap: 10 },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAssistant: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 0.5 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderTopWidth: 0.5,
  },
  disclaimerText: { fontSize: 11 },
  contactLink: { fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  input: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 15,
    maxHeight: 110,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
