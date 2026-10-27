import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 text-lg font-semibold tracking-tight text-stone-900">
      <span className="grid size-7 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white text-on-brand">J</span>
      JuLinks
    </Link>
  );
}
