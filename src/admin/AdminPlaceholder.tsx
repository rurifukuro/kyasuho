export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div>
      <h2 className="admin-page-title">{title}</h2>
      <div className="admin-placeholder">
        この機能は現在準備中です。次の更新で利用できるようになります。
      </div>
    </div>
  );
}
