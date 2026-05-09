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
          Sample data: Toronto demo. Turn off demo in the nav when your live API is connected.
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}

export const useDemoMode = () => useContext(DemoContext);
