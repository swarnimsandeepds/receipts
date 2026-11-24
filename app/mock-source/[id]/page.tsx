import { mockSource } from "@/lib/mock";
import { notFound } from "next/navigation";

export default async function MockSource({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const src = mockSource(id);
  if (!src) notFound();
  return (
    <main className="mx-auto max-w-2xl p-10">
      <div className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Mock source: seeded demo data, not a real article</div>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">{src.title}</h1>
      <p className="mt-1 text-sm text-neutral-500">{src.company}{src.date ? ` · ${src.date}` : ""}</p>
      <p className="mt-6 text-lg leading-relaxed text-neutral-800">{src.text}</p>
      <p className="mt-10 text-sm text-neutral-500">Accounts and signals in this demo come from a seeded dataset, so citations open this local page.</p>
    </main>
  );
}
