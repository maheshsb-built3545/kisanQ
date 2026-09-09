export function Banner({ type = 'error', message, onClose }) {
  if (!message) return null;

  const styles = {
    error: 'bg-error-container text-on-error-container',
    success: 'bg-secondary-fixed text-on-secondary-fixed',
    info: 'bg-primary-fixed text-on-primary-fixed',
  };

  const icons = {
    error: 'error',
    success: 'check_circle',
    info: 'info',
  };

  return (
    <div className={`p-4 rounded-xl text-sm font-bold flex items-center justify-between shadow-sm ${styles[type] || styles.error}`}>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-xl shrink-0">{icons[type] || 'info'}</span>
        <span>{message}</span>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 transition-colors">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
  );
}
