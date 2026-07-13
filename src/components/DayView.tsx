"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AddSheet } from "@/components/AddSheet";
import { DayHeader } from "@/components/DayHeader";
import { SettingsSheet } from "@/components/SettingsSheet";
import { MealCard } from "@/components/MealCard";
import { MicrosPanel } from "@/components/MicrosPanel";
import { NewMealButton } from "@/components/NewMealButton";
import { WeekChart, type WeekDay } from "@/components/WeekChart";
import type { DayResponse, Goal, MealSlot } from "@/lib/api-types";
import { todayYmd } from "@/lib/date";

type WeekResponse = {
  days: WeekDay[];
  goal: Goal;
  averages: { loggedDays: number; kcal: number; protein: number; carbs: number; fat: number };
};

type Tab = "day" | "week";

export function DayView({ accessory }: { accessory?: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>("day");
  const [day, setDay] = useState(todayYmd);
  const [data, setData] = useState<DayResponse | null>(null);
  const [week, setWeek] = useState<WeekResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Bumped whenever something we wrote needs re-reading. Refetching is the effect's job,
  // so mutations signal it rather than calling fetch themselves.
  const [stamp, setStamp] = useState(0);
  const refresh = useCallback(() => setStamp((n) => n + 1), []);

  useEffect(() => {
    // `stale` guards the day-switch race: tap ahead three days quickly and the older,
    // slower responses must not land on top of the newest one.
    let stale = false;

    (async () => {
      try {
        const [dayRes, weekRes] = await Promise.all([
          fetch(`/api/day?date=${day}`),
          fetch(`/api/week?end=${day}`),
        ]);
        if (!dayRes.ok || !weekRes.ok) throw new Error();
        const [dayJson, weekJson] = await Promise.all([dayRes.json(), weekRes.json()]);
        if (stale) return;
        setData(dayJson);
        setWeek(weekJson);
        setError(null);
      } catch {
        if (!stale) setError("Couldn't load your data.");
      }
    })();

    return () => {
      stale = true;
    };
  }, [day, stamp]);

  async function deleteEntry(id: string) {
    // Optimistic: the row vanishes on tap, then the refetch reconciles the totals.
    setData((d) => (d ? { ...d, entries: d.entries.filter((e) => e.id !== id) } : d));
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    refresh();
  }

  async function changeGrams(id: string, grams: number) {
    await fetch(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grams }),
    });
    refresh();
  }

  if (error) {
    return (
      <main className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={refresh}
            className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!data || !week) {
    return (
      <main className="grid flex-1 place-items-center">
        <Loader2 className="size-5 animate-spin text-muted" />
      </main>
    );
  }

  return (
    <>
      <DayHeader
        day={day}
        totals={data.totals}
        goal={data.goal}
        onDayChange={setDay}
        onEditGoals={() => setSettingsOpen(true)}
        accessory={accessory}
      />

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4">
        <div
          role="tablist"
          className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface p-1"
        >
          {(["day", "week"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md py-1.5 text-xs font-medium capitalize transition ${
                tab === t ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {t === "day" ? "Day" : "This week"}
            </button>
          ))}
        </div>

        {tab === "day" ? (
          <div className="space-y-3">
            {data.meals.map((meal) => (
              <MealCard
                key={meal.id}
                meal={meal}
                entries={data.entries.filter((e) => e.mealId === meal.id)}
                onAdd={setAdding}
                onDelete={deleteEntry}
                onGramsChange={changeGrams}
              />
            ))}

            <NewMealButton onCreated={refresh} />

            <MicrosPanel totals={data.totals} />

            <p className="px-1 pb-6 pt-2 text-center text-[11px] leading-relaxed text-muted">
              Items marked <span className="uppercase tracking-wide">est</span> are the AI
              model&apos;s estimate rather than a nutrition-database value — a ballpark, not a
              lab result. Correct any portion by tapping its weight.
            </p>
          </div>
        ) : (
          <WeekChart days={week.days} goal={week.goal} averages={week.averages} />
        )}
      </main>

      {adding && (
        <AddSheet
          meal={adding}
          day={day}
          onClose={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            refresh();
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          goal={data.goal}
          meals={data.meals}
          onClose={() => setSettingsOpen(false)}
          // Stay open: meals are edited several at a time, and a sheet that slams shut after
          // each rename would be maddening. Just re-read so the list underneath stays true.
          onChanged={refresh}
        />
      )}
    </>
  );
}
