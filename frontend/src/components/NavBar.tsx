"use client";

import Link from "next/link";
import { CityLensLogo } from "@/components/CityLensLogo";
import { useDemoMode } from "@/components/DemoProvider";
import { DemoToggle } from "@/components/ui/demo-toggle";

interface Props {
  onRefresh: () => void;
}

export function NavBar({ onRefresh }: Props) {
  const { demoMode, setDemoMode } = useDemoMode();

  return (
    <nav
      style={{
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: "transparent",
        padding: "0 16px",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontFamily: "var(--font-display)",
          fontSize: 16,
          fontWeight: 700,
          color: "var(--cl-text-primary)",
          textDecoration: "none",
          marginRight: 20,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
        }}
      >
        <CityLensLogo size={26} />
        CityLens
      </Link>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        style={{
          background: "transparent",
          border: "1px solid var(--cl-border)",
          borderRadius: 6,
          color: "var(--cl-text-muted)",
          padding: "4px 10px",
          cursor: "pointer",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          marginLeft: "auto",
          marginRight: 12,
          transition: "var(--transition)",
        }}
      >
        ↺
      </button>

      {/* Demo toggle */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--cl-text-muted)",
            whiteSpace: "nowrap",
            fontWeight: 500,
          }}
        >
          Demo
        </span>
        <DemoToggle checked={demoMode} onChange={setDemoMode} />
      </label>
    </nav>
  );
}
