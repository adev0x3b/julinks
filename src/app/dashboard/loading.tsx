export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <div className="h-40 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-64 animate-pulse rounded-2xl bg-stone-200" />
      </div>
      <div className="mx-auto aspect-[9/17] w-full max-w-[320px] animate-pulse rounded-[2.5rem] bg-stone-200" />
    </div>
  );
}
