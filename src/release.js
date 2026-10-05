// 4D release numbering: feature releases "R" sit between LTS majors.
// 18 < 18 R2 < ... < 18 R6 < 19 < 19 R2 < ... < 20 R10 < 21 < 21 R2 ...
// Older names are normalized too: "v14", "11 SQL", "2004" (-> 8), "2003" (-> 7), "6.0".

const LEGACY_YEARS = { 2003: 7, 2004: 8 };

/**
 * Parse a release label into { major, r, minor, label } or null when not a release.
 * @param {string} input
 */
export function parseRelease(input) {
  if (input == null) return null;
  let s = String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[*_`]/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
  s = s.replace(/^4D\s*/i, '').replace(/^v(?=\d)/i, '').trim();
  const m = s.match(/^(\d{1,4})(?:\.(\d+))?(?:\.\d+)*\s*(?:SQL\b)?\s*(?:R\s*(\d+))?(?=$|[\s,;:()/-])/i);
  if (!m) return null;
  let major = Number(m[1]);
  if (LEGACY_YEARS[major]) major = LEGACY_YEARS[major];
  if (major > 99) return null;
  const minor = m[2] ? Number(m[2]) : 0;
  const r = m[3] ? Number(m[3]) : 0;
  return { major, r, minor, label: formatRelease({ major, r }) };
}

export function formatRelease(rel) {
  if (!rel) return '';
  return rel.r ? `${rel.major} R${rel.r}` : String(rel.major);
}

/** Normalize a label ("v20R10" -> "20 R10"); returns null when not parseable. */
export function normalizeRelease(input) {
  const rel = parseRelease(input);
  return rel ? formatRelease(rel) : null;
}

/** Compare two releases (strings or parsed). Unparseable values sort first. */
export function compareReleases(a, b) {
  const ra = typeof a === 'object' && a !== null ? a : parseRelease(a);
  const rb = typeof b === 'object' && b !== null ? b : parseRelease(b);
  if (!ra && !rb) return 0;
  if (!ra) return -1;
  if (!rb) return 1;
  return ra.major - rb.major || ra.r - rb.r || ra.minor - rb.minor;
}

/** Earliest of a list of release labels (ignores unparseable values). */
export function minRelease(labels) {
  let best = null;
  for (const l of labels) {
    const r = parseRelease(l);
    if (r && (!best || compareReleases(r, best) < 0)) best = r;
  }
  return best ? formatRelease(best) : null;
}

/** True when `release` is available at `floor` (release <= floor). Unknown release => true. */
export function isAvailableAt(release, floor) {
  if (!floor) return true;
  if (!release) return true;
  return compareReleases(release, floor) <= 0;
}

/** Map a docs version id ("21-R4", "20", "latest") to a release label. */
export function docsVersionToRelease(version) {
  if (!version || version === 'latest' || version === 'current') return null;
  return normalizeRelease(String(version).replace(/-/g, ' '));
}
