export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh items-center justify-center px-4 py-12">
      <div className="studi-grain pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
