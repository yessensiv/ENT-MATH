import type { Bilingual, BilingualSteps, Example } from './content.ts';

/** Authored lesson supplements. Examples are educational models, not factual claims. */
export interface LessonEnrichment {
  intuition: Bilingual;
  details: { title: Bilingual; body: Bilingual }[];
  hacks: { title: Bilingual; body: Bilingual; caution: Bilingual }[];
  life: Example & { title: Bilingual; connection: Bilingual; takeaway: Bilingual };
  checks: { expression: string; expected: number }[];
}
export type EnrichmentMap = Record<string, LessonEnrichment>;
export const bi = (ru: string, kk: string): Bilingual => ({ ru, kk });
export const lines = (...steps: Bilingual[]): BilingualSteps => ({ru: steps.map(s=>s.ru), kk: steps.map(s=>s.kk)});
