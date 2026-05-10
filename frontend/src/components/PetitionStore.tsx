'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { PetitionDoc } from '@/lib/petition';

const STORAGE_KEY = 'citylens.petitions.v1';

interface PetitionStoreValue {
  drafts: PetitionDoc[];
  selectedDraft: PetitionDoc | null;
  addDraft: (doc: PetitionDoc) => void;
  updateDraft: (id: string, partial: Partial<PetitionDoc>) => void;
  removeDraft: (id: string) => void;
  selectDraft: (id: string | null) => void;
}

const PetitionStoreContext = createContext<PetitionStoreValue | null>(null);

function loadDrafts(): PetitionDoc[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PetitionDoc[]) : [];
  } catch {
    return [];
  }
}

function persistDrafts(drafts: PetitionDoc[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // ignore quota / privacy errors
  }
}

export function PetitionStoreProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<PetitionDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    setDrafts(loadDrafts());
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    persistDrafts(drafts);
  }, [drafts]);

  const addDraft = useCallback((doc: PetitionDoc) => {
    setDrafts((prev) => [doc, ...prev.filter((d) => d.id !== doc.id)]);
    setSelectedId(doc.id);
  }, []);

  const updateDraft = useCallback(
    (id: string, partial: Partial<PetitionDoc>) => {
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...partial } : d)),
      );
    },
    [],
  );

  const removeDraft = useCallback((id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setSelectedId((curr) => (curr === id ? null : curr));
  }, []);

  const selectDraft = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.id === selectedId) ?? null,
    [drafts, selectedId],
  );

  const value = useMemo<PetitionStoreValue>(
    () => ({
      drafts,
      selectedDraft,
      addDraft,
      updateDraft,
      removeDraft,
      selectDraft,
    }),
    [drafts, selectedDraft, addDraft, updateDraft, removeDraft, selectDraft],
  );

  return (
    <PetitionStoreContext.Provider value={value}>
      {children}
    </PetitionStoreContext.Provider>
  );
}

export function usePetitionStore(): PetitionStoreValue {
  const ctx = useContext(PetitionStoreContext);
  if (!ctx) {
    throw new Error('usePetitionStore must be used within PetitionStoreProvider');
  }
  return ctx;
}
