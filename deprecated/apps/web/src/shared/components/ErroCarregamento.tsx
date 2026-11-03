export function ErroCarregamento({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
      role="alert"
    >
      {children}
    </p>
  );
}
