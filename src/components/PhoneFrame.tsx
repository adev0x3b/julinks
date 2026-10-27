export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="aspect-[9/17] overflow-hidden rounded-[2.5rem] border-[10px] border-[#1c1917] bg-[#1c1917] shadow-2xl">
      <div className="h-full overflow-y-auto rounded-[2rem]">{children}</div>
    </div>
  );
}
