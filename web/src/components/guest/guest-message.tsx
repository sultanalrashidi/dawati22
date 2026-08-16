export function GuestMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#14110d] px-6 text-center text-[#f3ede3]">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-[#b8ac9a]">{body}</p>
    </div>
  );
}
