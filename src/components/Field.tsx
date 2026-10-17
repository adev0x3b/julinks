export function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
      {error && (
        <p className="error" role="alert" id={`${name}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
