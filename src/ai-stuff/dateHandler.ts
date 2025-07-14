import * as chrono from 'chrono-node';

export function parseNaturalDate(input: string): Date | null {
  const parsed = chrono.parseDate(input);
  return parsed ?? null;
}
