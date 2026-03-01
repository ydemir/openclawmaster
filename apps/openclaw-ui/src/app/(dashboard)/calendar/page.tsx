"use client";

import { WeeklyCalendar } from "@/components/WeeklyCalendar";

export default function TakvimPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Takvim</h1>
        <p className="text-gray-400">
          Planlanan görevler ve cron işlerinin haftalık görünümü
        </p>
      </div>

      <WeeklyCalendar />
    </div>
  );
}


