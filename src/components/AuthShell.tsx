import { Logo } from "@/components/Logo";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <Logo />
      <div className="card mt-8 w-full max-w-sm">
        <h1 className="mb-6 text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
