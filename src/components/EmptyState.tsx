interface EmptyStateProps {
  message: string;
  onRetry?: () => void;
}

export function EmptyState({ message, onRetry }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-[var(--text-secondary)]">
      <div className="text-4xl mb-4">📊</div>
      <p className="text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-[var(--badge-bg)] border border-[var(--border)]
            rounded-md text-sm text-[var(--text-primary)] hover:opacity-80
            transition-opacity cursor-pointer"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
