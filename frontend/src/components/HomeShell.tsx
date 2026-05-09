"use client";

import MapView from "@/components/MapView";

export default function HomeShell() {
  return (
    <div className="flex h-[100dvh] min-h-0 flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">CityLens</p>
          <h1 className="text-lg font-semibold text-zinc-900">Urban heat vulnerability</h1>
        </div>
        <nav className="flex gap-4 text-sm">
          <a className="text-zinc-700 underline-offset-4 hover:underline" href="/">
            Map
          </a>
          <a className="text-zinc-700 underline-offset-4 hover:underline" href="/dashboard">
            Dashboard
          </a>
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <MapView />
      </main>
    </div>
  );
}
