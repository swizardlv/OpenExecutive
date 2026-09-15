"use client";

import { useI18n } from "@/lib/i18n";
import CadenceSection, { FollowUpsCard } from "./CadenceSection";
import MemorySection from "./MemorySection";
import PulseHeader from "./PulseHeader";

export default function PulsePage() {
  const { locale, t } = useI18n();

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-10">
      <PulseHeader />

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="min-w-0">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-4">
            {t("memories.PulsePage.heartbeat_the_rhythm_it_runs")}
          </h2>
          <CadenceSection />
        </section>

        <section className="min-w-0 space-y-8">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-4">
              {t("memories.PulsePage.memory_what_it_knows")}
            </h2>
            <MemorySection />
          </div>
          <FollowUpsCard />
        </section>
      </div>
    </div>
  );
}
