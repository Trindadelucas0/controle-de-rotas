import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="safe-pb safe-pt relative flex min-h-[100dvh] items-center justify-center px-4 max-md:h-[100dvh] max-md:overflow-y-auto max-md:[align-items:safe_center]">
      <div className="absolute right-4 top-[max(1rem,var(--safe-top))]">
        <ThemeToggle />
      </div>
      {children}
    </main>
  );
}
