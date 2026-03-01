"use client";

import { GlobalSearch } from "@/components/GlobalSearch";

export default function SearchPage() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 
          className="text-2xl md:text-3xl font-bold mb-1 md:mb-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
          Genel Arama
        </h1>
        <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
          Aktivite, görev ve indeksli belgelerde arama yapın
        </p>
      </div>

      <GlobalSearch fullPage />
    </div>
  );
}

