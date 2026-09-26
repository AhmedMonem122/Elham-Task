import { randomUUID } from 'node:crypto';

/** Generate a v4 UUID for Slot / Booking primary keys (app-side). */
export function newId(): string {
  return randomUUID();
}

/** Trim leading/trailing whitespace; non-strings become '' (fail validation). */
export function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Lenient UUID check used for manual guards (pipes handle the rest). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Serialize a Date to strict ISO-8601 UTC (…Z) as the spec requires. */
export function toIsoUtc(date: Date): string {
  return date.toISOString();
}
