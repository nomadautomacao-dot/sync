export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded-[var(--sync-radius-md)] bg-[var(--sync-bg-surface)]"
        />
      ))}
    </div>
  );
}
