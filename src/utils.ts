const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Matches bearblog's "d M, Y" format, e.g. "07 Jun, 2026". UTC to avoid TZ drift. */
export function fmtDate(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day} ${MONTHS[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/** "Machine Learning" -> "machine-learning" */
export function tagSlug(t: string): string {
  return t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
