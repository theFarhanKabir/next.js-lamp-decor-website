import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[#A67C3D]">404</p>
      <h1 className="mb-4 text-3xl font-light text-[#1A1815]">This page isn’t here</h1>
      <p className="mb-8 max-w-md text-sm leading-6 text-[#8A8377]">
        The page may have moved, or the address may be incorrect.
      </p>
      <Link href="/" className="rounded bg-[#1A1815] px-6 py-3 text-xs font-medium uppercase tracking-widest text-white">
        Return home
      </Link>
    </main>
  );
}
