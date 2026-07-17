// §55 オーナー向け満足度アンケート（管理Web版・WEB13=アプリ SurveyBanner と両面同時実装）
// 回答は任意（督促しない）。バナー→モーダルで回答→ ky_submit_survey RPC（BE-4）。
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type SurveyKind = 'trial_end' | 'cancel' | 'semiannual';

type SurveyInvite = {
  id: string;
  survey_kind: SurveyKind;
  status: string;
};

const RATING_ITEMS: { key: string; label: string }[] = [
  { key: 'overall', label: '総合満足度' },
  { key: 'base', label: '予約台帳・受付' },
  { key: 'register', label: 'レジ・オーダー管理' },
  { key: 'shift', label: 'シフト表作成' },
  { key: 'sales', label: '売上・給与管理' },
  { key: 'analytics', label: '分析・ダッシュボード' },
  { key: 'customer', label: 'お客様モード' },
  { key: 'attendance', label: '勤怠管理' },
  { key: 'expense', label: '経費管理' },
];

const KIND_LEAD: Record<SurveyKind, string> = {
  trial_end: '無料トライアルをご利用いただき、ありがとうございました。',
  cancel: 'ご利用いただき、ありがとうございました。',
  semiannual: 'いつもきゃすりんをご利用いただき、ありがとうございます。',
};

export function SurveyPrompt({ tenantId }: { tenantId: string }) {
  const [invite, setInvite] = useState<SurveyInvite | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reasonTrigger, setReasonTrigger] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvement, setImprovement] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [allowPublish, setAllowPublish] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    supabase
      .from('ky_survey_invites')
      .select('id, survey_kind, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInvite(data as SurveyInvite);
      });
  }, [tenantId]);

  if (!invite || dismissed) return null;

  const setRating = (key: string, value: number) => {
    // 同じ星の再クリックで未回答（0）へ戻す＝任意回答
    setRatings((prev) => ({ ...prev, [key]: prev[key] === value ? 0 : value }));
  };

  const hasAnyInput =
    Object.values(ratings).some((v) => v >= 1) ||
    reasonTrigger.trim() !== '' ||
    strengths.trim() !== '' ||
    improvement.trim() !== '' ||
    cancelReason.trim() !== '';

  const handleSubmit = async () => {
    if (!hasAnyInput || submitting) return;
    setSubmitting(true);
    setErrorMsg('');
    try {
      const cleanRatings: Record<string, number> = {};
      for (const [k, v] of Object.entries(ratings)) {
        if (v >= 1 && v <= 5) cleanRatings[k] = v;
      }
      const { data, error } = await supabase.rpc('ky_submit_survey', {
        p_invite_id: invite.id,
        p_ratings: cleanRatings,
        p_reason_trigger: reasonTrigger.trim() || null,
        p_strengths: strengths.trim() || null,
        p_improvement: improvement.trim() || null,
        p_cancel_reason: cancelReason.trim() || null,
        p_allow_publish: allowPublish,
      });
      const result = (data ?? {}) as { ok?: boolean; error?: string };
      if (error || (!result.ok && result.error !== 'already_answered')) {
        setErrorMsg('送信に失敗しました。時間をおいて再度お試しください。');
        return;
      }
      setOpen(false);
      setInvite(null);
      window.alert('アンケートを送信しました。ご協力ありがとうございました！');
    } catch {
      setErrorMsg('送信に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="dev-announcements">
        <div className="dev-announcement-banner">
          <span className="dev-announcement-icon">📋</span>
          <div className="dev-announcement-content">
            <strong>アンケートご協力のお願い</strong>
            <span className="dev-announcement-body">
              サービス改善のため、よろしければアンケートにご協力ください（回答は任意です）。
            </span>
            <button type="button" className="survey-open-btn" onClick={() => setOpen(true)}>
              アンケートに回答する
            </button>
          </div>
          <button
            type="button"
            className="dev-announcement-dismiss"
            onClick={() => setDismissed(true)}
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-content survey-modal" onClick={(e) => e.stopPropagation()}>
            <h2>きゃすりん改善アンケート</h2>
            <p className="survey-lead">{KIND_LEAD[invite.survey_kind]}</p>
            <p className="survey-intro">
              回答はすべて任意です。ご協力いただける範囲でお聞かせください。いただいた内容は今後のサービス改善に活用させていただきます。
            </p>

            <div className="survey-section-title">機能の満足度（★をクリック・任意）</div>
            {RATING_ITEMS.map((item) => (
              <div key={item.key} className="survey-star-row">
                <span className="survey-star-label">{item.label}</span>
                <span className="survey-stars">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`survey-star${(ratings[item.key] ?? 0) >= n ? ' filled' : ''}`}
                      onClick={() => setRating(item.key, n)}
                      aria-label={`${item.label} ${n}点`}
                    >
                      {(ratings[item.key] ?? 0) >= n ? '★' : '☆'}
                    </button>
                  ))}
                </span>
              </div>
            ))}

            <label>
              きゃすりんを利用しようと思ったきっかけ（任意）
              <textarea
                value={reasonTrigger}
                onChange={(e) => setReasonTrigger(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="ご自由にご記入ください"
              />
            </label>
            <label>
              他のオーナー様に伝えたい「きゃすりんの強み」（任意）
              <textarea
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="ご自由にご記入ください"
              />
            </label>
            <label className="survey-check-row">
              <input
                type="checkbox"
                checked={allowPublish}
                onChange={(e) => setAllowPublish(e.target.checked)}
              />
              この「強み」を紹介事例として掲載してもよい（店名は公開されません）
            </label>
            <label>
              不満な点・改善してほしい点（任意）
              <textarea
                value={improvement}
                onChange={(e) => setImprovement(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="ご自由にご記入ください"
              />
            </label>
            {invite.survey_kind === 'cancel' && (
              <label>
                解約を決めた理由（任意）
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  maxLength={2000}
                  rows={3}
                  placeholder="ご自由にご記入ください"
                />
              </label>
            )}

            {errorMsg && <p className="survey-error">{errorMsg}</p>}
            <div className="modal-actions">
              <button type="button" className="admin-btn" onClick={() => setOpen(false)}>
                あとで回答する
              </button>
              <button
                type="button"
                className="admin-btn primary"
                disabled={!hasAnyInput || submitting}
                onClick={() => void handleSubmit()}
              >
                {submitting ? '送信中…' : '送信する'}
              </button>
            </div>
            <p className="survey-footnote">回答は任意です。ご協力ありがとうございます。</p>
          </div>
        </div>
      )}
    </>
  );
}
