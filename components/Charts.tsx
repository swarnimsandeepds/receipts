"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MOCK_HISTORY } from "@/lib/mock";
import type { Lead } from "@/lib/types";
import { card } from "./ui";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const bucket = (ind: string) => (/voice|conversational/i.test(ind) ? "Voice AI" : /support|contact/i.test(ind) ? "Support software" : /sales|meeting/i.test(ind) ? "Sales copilots" : /health/i.test(ind) ? "Healthcare tech" : ind.split(" ").slice(0, 2).join(" "));

export function Charts({ leads }: { leads: Lead[] }) {
  const contacted = (l: Lead) => l.stage !== "Matched";
  const replied = (l: Lead) => l.stage === "Replied" || l.stage === "Meeting Booked";
  const meeting = (l: Lead) => l.stage === "Meeting Booked";
  const roll = (base: { name: string; contacted: number; replied: number; meetings: number }[], key: (l: Lead) => string) => {
    const rows = base.map((r) => ({ ...r }));
    for (const l of leads) {
      let r = rows.find((x) => x.name === key(l));
      if (!r) { r = { name: key(l), contacted: 0, replied: 0, meetings: 0 }; rows.push(r); }
      if (contacted(l)) r.contacted++; if (replied(l)) r.replied++; if (meeting(l)) r.meetings++;
    }
    return rows.filter((r) => r.contacted > 0).map((r) => ({ name: r.name, "Reply rate %": pct(r.replied, r.contacted), "Meeting rate %": pct(r.meetings, r.contacted), n: r.contacted }));
  };
  const byIndustry = roll(MOCK_HISTORY.byIndustry, (l) => bucket(l.industry));
  const byTier = roll(MOCK_HISTORY.byTier, (l) => l.tier);
  const ab = MOCK_HISTORY.ab.map((r, i) => {
    const t = i === 0 ? "A" : "B";
    const mine = leads.filter((l) => l.template === t);
    const sent = r.sent + mine.filter(contacted).length, rep = r.replied + mine.filter(replied).length, meet = r.meetings + mine.filter(meeting).length;
    return { name: r.name, "Reply rate %": pct(rep, sent), "Meeting rate %": pct(meet, sent), n: sent };
  });
  const Chart = ({ title, data, note }: { title: string; data: Record<string, string | number>[]; note?: string }) => (
    <div className={`${card} p-4`}>
      <h3 className="font-serif text-lg font-semibold">{title}</h3>
      <p className="mb-2 text-xs text-neutral-500">{note ?? "Share of contacted leads that replied or booked a meeting."}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip formatter={(v, n, p) => [`${v}% (n=${(p.payload as { n: number }).n})`, n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Reply rate %" fill="#2563eb" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Meeting rate %" fill="#059669" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
  return (
    <div>
      <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">Charts combine seeded historical outcomes (mock) with this session's pipeline. Move cards on the Pipeline tab and the numbers update.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {Chart({ title: "Conversion by industry", data: byIndustry })}
        {Chart({ title: "Conversion by tier", data: byTier })}
        {Chart({ title: "A/B: message template", data: ab, note: "Template A opens with the trigger signal. Template B opens with the pain." })}
      </div>
    </div>
  );
}
