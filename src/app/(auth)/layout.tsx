export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10 md:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_10%_-10%,color-mix(in_srgb,var(--accent-soft)_85%,transparent),transparent),radial-gradient(900px_500px_at_90%_110%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent)]"
      />
      <div className="studi-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
