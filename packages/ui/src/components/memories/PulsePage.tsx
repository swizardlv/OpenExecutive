"use client";

import { useI18n } from "@/lib/i18n";
import CadenceSection, { FollowUpsCard } from "./CadenceSection";
import MemorySection from "./MemorySection";
import PulseHeader from "./PulseHeader";

export default function PulsePage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
      <PulseHeader />

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="min-w-0">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-4">
            {isZh ? "运行节拍 — 自动化工作节奏" : "Heartbeat — the rhythm it runs on"}
          </h2>
          <CadenceSection />
        </section>

        <section className="min-w-0 space-y-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-4">
              {isZh ? "长期记忆 — 萃取沉淀的知识" : "Memory — what it knows"}
            </h2>
            <MemorySection />
          </div>
          <FollowUpsCard />
        </section>
      </div>
    </div>
  );
}
