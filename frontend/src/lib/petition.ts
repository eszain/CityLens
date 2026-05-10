import type { Block } from '@/types';

export interface PetitionMeta {
  name: string;
  organization: string;
  targetAudience: string;
  /** ISO date string captured when the form was opened. */
  dateCreated: string;
}

export interface PetitionDoc {
  id: string;
  meta: PetitionMeta;
  block: {
    id: string;
    name: string;
    severity: Block['severity'];
    incomeDecile: number;
    heatScore: number;
    temperatureDelta: number;
    treeCanopy: number;
    impervious: number;
    population: number;
    airQualityIndex: number;
    floodRisk: Block['floodRisk'];
    summary: string | null | undefined;
    interventions: string[];
  };
  subject: string;
  body: string;
  /** Editable header fields shown in the panel + PDF. Initialized from `meta`/`block`. */
  display: {
    to: string;
    from: string;
    blockLabel: string;
    dateLabel: string;
  };
}

interface ApiPayload {
  meta: PetitionMeta;
  block: PetitionDoc['block'];
}

interface ApiResponse {
  subject: string;
  body: string;
}

export function buildBlockContext(block: Block): PetitionDoc['block'] {
  return {
    id: block.id,
    name: block.name,
    severity: block.severity,
    incomeDecile: block.incomeDecile,
    heatScore: block.heatScore,
    temperatureDelta: block.temperatureDelta,
    treeCanopy: block.treeCanopy,
    impervious: block.impervious,
    population: block.population,
    airQualityIndex: block.airQualityIndex,
    floodRisk: block.floodRisk,
    summary: block.mlScoring?.summary,
    interventions: block.mlScoring?.top_interventions ?? [],
  };
}

function defaultDisplay(meta: PetitionMeta, block: PetitionDoc['block']) {
  const fromLine =
    [meta.name, meta.organization].filter(Boolean).join(' · ') ||
    'Concerned constituent';
  return {
    to: meta.targetAudience,
    from: fromLine,
    blockLabel: `${block.name} · ${block.severity} · income decile ${block.incomeDecile}/10`,
    dateLabel: formatPetitionDate(meta.dateCreated),
  };
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function requestPetitionDraft(
  meta: PetitionMeta,
  block: Block,
): Promise<PetitionDoc> {
  const blockCtx = buildBlockContext(block);
  const payload: ApiPayload = { meta, block: blockCtx };
  const res = await fetch('/api/petition', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) detail = `${res.status}: ${j.error}`;
    } catch {}
    throw new Error(`Petition draft failed (${detail})`);
  }
  const json = (await res.json()) as ApiResponse;
  return {
    id: makeId(),
    meta,
    block: blockCtx,
    subject: stripMarkdown(json.subject),
    body: stripMarkdown(json.body),
    display: defaultDisplay(meta, blockCtx),
  };
}

/** Best-effort cleanup of common markdown markers Haiku might still emit. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^```[a-zA-Z]*\n?|```$/gm, '')          // code fences
    .replace(/^#{1,6}\s+/gm, '')                      // headings
    .replace(/^\s*[-*+]\s+/gm, '')                    // bullet markers
    .replace(/^\s*\d+\.\s+/gm, '')                    // numbered list markers
    .replace(/\*\*(.+?)\*\*/g, '$1')                  // **bold**
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1') // *italic*
    .replace(/__(.+?)__/g, '$1')                      // __bold__
    .replace(/_(.+?)_/g, '$1')                        // _italic_
    .replace(/`([^`\n]+)`/g, '$1')                    // `inline code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')          // [link](url)
    .trim();
}

export function formatPetitionDate(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-CA', { dateStyle: 'long' }).format(d);
}

export function petitionFilename(doc: PetitionDoc): string {
  const slug = doc.block.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'block';
  const d = new Date(doc.meta.dateCreated);
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `citylens-petition-${slug}-${yyyymmdd}.pdf`;
}
