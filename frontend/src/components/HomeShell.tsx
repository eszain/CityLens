"use client";

import { useState, type ReactNode } from "react";

import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";

export default function HomeShell({ rightPanel }: { rightPanel: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Map occupies the full viewport — never resizes */}
      <div className="absolute inset-0">
        <MapView leftPanelOpen={leftOpen} />
      </div>

      {/* Left panel — floats over the map */}
      <aside
        className={`absolute bottom-0 left-0 top-0 z-10 flex flex-col overflow-hidden border-r border-border bg-background/90 backdrop-blur-md transition-[width] duration-300 ease-out [will-change:width] ${
          leftOpen ? "w-80" : "w-10"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
          {leftOpen && (
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Left panel
            </p>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setLeftOpen((v) => !v)}
            aria-label={leftOpen ? "Collapse left panel" : "Expand left panel"}
            className="ml-auto"
          >
            {leftOpen ? "‹" : "›"}
          </Button>
        </div>
        <div className={`flex-1 overflow-y-auto ${leftOpen ? "" : "hidden"}`}>
          {/* future content */}
        </div>
      </aside>

      {/* Right panel — floats over the map */}
      <aside
        className={`absolute bottom-0 right-0 top-0 z-10 flex flex-col overflow-hidden border-l border-border bg-background/90 backdrop-blur-md transition-[width] duration-300 ease-out [will-change:width] ${
          rightOpen ? "w-80" : "w-10"
        }`}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRightOpen((v) => !v)}
            aria-label={rightOpen ? "Collapse right panel" : "Expand right panel"}
            className="mr-auto"
          >
            {rightOpen ? "›" : "‹"}
          </Button>
          {rightOpen && (
            <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Dashboard
            </p>
          )}
        </div>
        <div className={`flex-1 overflow-y-auto ${rightOpen ? "" : "hidden"}`}>
          {rightPanel}
        </div>
      </aside>
    </div>
  );
}
