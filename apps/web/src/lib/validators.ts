// ============================================================================
// Validation Utilities
// ============================================================================

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[1-9]\d{7,14}$/; // E.164-ish
export const ROLL_NUMBER_RE = /^[A-Z0-9\-_./]{2,30}$/i;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isRollNumber(value: string): boolean {
  return ROLL_NUMBER_RE.test(value.trim());
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isDateIso(value: string): boolean {
  if (!DATE_ISO_RE.test(value)) return false;
  const t = Date.parse(value);
  return !Number.isNaN(t);
}

export function normalizePhone(value: string): string {
  let v = value.trim().replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
  if (v.startsWith('+')) return v;
  
  // If it's a 10-digit number, assume it's Indian (+91)
  if (v.length === 10 && /^\d+$/.test(v)) {
    return `+91${v}`;
  }
  
  // If it starts with 0 and then 10 digits, replace 0 with +91
  if (v.length === 11 && v.startsWith('0')) {
    return `+91${v.substring(1)}`;
  }

  // Otherwise just ensure it has a plus sign if it looks like a country code was included but without +
  if (!v.startsWith('+')) {
    // If it starts with 91 and has 12 digits total
    if (v.startsWith('91') && v.length === 12) return `+${v}`;
    return `+${v}`;
  }
  
  return v;
}

export interface RequiredFieldResult {
  ok: boolean;
  errors: Record<string, string>;
}

export function requireFields<T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): RequiredFieldResult {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const v = obj[f];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      errors[String(f)] = `${String(f)} is required`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
