import Anthropic from '@anthropic-ai/sdk';
import { stripMarkdown, type PetitionDoc, type PetitionMeta } from '@/lib/petition';

const PETITION_SYSTEM_PROMPT = `You are a civic-engagement writer helping a Toronto resident draft a formal petition to a public official or organization.

Write in a respectful, accessible tone — clear, urgent without being shrill, suitable for a petition that real people will sign and that a councillor's office will read. The petition should:

1. Address the named target audience directly.
2. Identify the affected city block by name and cite the most relevant climate-equity metrics (heat score, temperature delta, tree canopy, air quality, flood risk, income decile) in plain language.
3. Briefly explain why these conditions are unjust — connect the environmental burden to the community's vulnerability.
4. Propose 2–3 concrete interventions, drawing from the AI-recommended interventions provided. Weave them into prose sentences — do NOT format them as a bulleted list.
5. Close with a clear ask (timeline, public commitment, follow-up meeting).
6. Be roughly 350–500 words total.

Output format — strict:
- First line: \`Subject: <one-line subject>\`
- Then a blank line
- Then the petition body, written as plain paragraphs separated by blank lines.

CRITICAL — plain text only. Do NOT use any Markdown formatting:
- No \`**bold**\`, \`__bold__\`, \`*italic*\`, or \`_italic_\` markers.
- No \`#\`, \`##\`, or \`###\` headings.
- No \`-\`, \`*\`, \`+\`, or numbered list markers (\`1.\`, \`2.\`) at the start of lines.
- No backtick code spans or \`\`\` code fences.
- No \`[text](url)\` links — write URLs as plain text if needed.
- No tables.

Do not include a salutation block, addresses, or sign-off lines like "Sincerely" — just the petition body. Output only the prose.`;

type ApiBlockContext = PetitionDoc['block'];

interface ApiPayload {
  meta: PetitionMeta;
  block: ApiBlockContext;
}

function buildUserPrompt(meta: PetitionMeta, block: ApiBlockContext): string {
  const senderLine = [meta.name, meta.organization].filter(Boolean).join(', ');
  const interventionsList = block.interventions.length
    ? block.interventions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
    : '(no AI-recommended interventions provided — propose your own based on the metrics)';

  return `Draft a petition with the following details.

TARGET AUDIENCE: ${meta.targetAudience}
SENDER: ${senderLine || '(individual constituent — name will be filled in by signers)'}
DATE: ${new Date(meta.dateCreated).toDateString()}

BLOCK: ${block.name}
SEVERITY: ${block.severity}
INCOME DECILE: ${block.incomeDecile}/10 (1 = lowest income, 10 = highest)
POPULATION: ${block.population.toLocaleString()}

CLIMATE METRICS:
- Heat score: ${block.heatScore}/100
- Temperature delta vs city baseline: +${block.temperatureDelta}°C
- Tree canopy coverage: ${block.treeCanopy}%
- Impervious surface: ${block.impervious}%
- Air quality index: ${block.airQualityIndex}
- Flood risk: ${block.floodRisk}

AI ANALYSIS SUMMARY:
${block.summary?.trim() || '(no summary provided)'}

AI-RECOMMENDED INTERVENTIONS:
${interventionsList}

Write the petition now, following the format and tone in the system prompt.`;
}

function parseResponse(text: string): { subject: string; body: string } {
  const trimmed = text.trim();
  const subjectMatch = trimmed.match(/^Subject:\s*(.+?)\s*\n([\s\S]*)$/i);
  if (subjectMatch) {
    return { subject: subjectMatch[1].trim(), body: subjectMatch[2].trim() };
  }
  const lines = trimmed.split('\n');
  return {
    subject: lines[0].slice(0, 120),
    body: trimmed,
  };
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY not configured on the server.' },
      { status: 500 },
    );
  }

  let payload: ApiPayload;
  try {
    payload = (await request.json()) as ApiPayload;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { meta, block } = payload ?? {};
  if (!meta?.targetAudience?.trim()) {
    return Response.json(
      { error: 'targetAudience is required.' },
      { status: 400 },
    );
  }
  if (!block?.id || !block?.name) {
    return Response.json(
      { error: 'block.id and block.name are required.' },
      { status: 400 },
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: PETITION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildUserPrompt(meta, block) },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Response.json(
        { error: 'Model returned no text content.' },
        { status: 502 },
      );
    }

    const parsed = parseResponse(textBlock.text);
    const subject = stripMarkdown(parsed.subject);
    const body = stripMarkdown(parsed.body);
    return Response.json({ subject, body });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: 'Rate limited by Anthropic — try again shortly.' },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: `Anthropic API error: ${err.message}` },
        { status: err.status ?? 502 },
      );
    }
    const detail = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: detail }, { status: 500 });
  }
}
