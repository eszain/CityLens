'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface DemoContextType {
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
}

const DemoContext = createContext<DemoContextType>({ demoMode: true, setDemoMode: () => {} });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [demoMode, setDemoMode] = useState(true); // default to demo

  return (
    <DemoContext.Provider value={{ demoMode, setDemoMode }}>
      {demoMode && (
        <div className="demo-banner">
          ⚡ DEMO MODE — displaying synthetic Toronto data · toggle in nav to connect live backend
        </div>
      )}
      <div style={{ paddingTop: demoMode ? 32 : 0, transition: 'padding-top 0.2s' }}>
        {children}
      </div>
    </DemoContext.Provider>
  );
}

export const useDemoMode = () => useContext(DemoContext);
