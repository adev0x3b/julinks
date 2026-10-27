import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Nothing here</h1>
      <p className="text-stone-600">That page does not exist, or the username has not been claimed yet.</p>
      <Link href="/signup" className="btn-primary">
        Request it
      </Link>
    </main>
  );
}
