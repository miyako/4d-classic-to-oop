// Load and validate mapping.yaml (curated source of truth).
import fs from 'node:fs';
import YAML from 'yaml';

export const CLASSIFICATIONS = ['Drop-in', 'Refactor', 'Partial'];

/**
 * @returns {{ schema: number, ignore: string[], mappings: Array<{command: string, targets: string[], classification: string, note?: string, note_ja?: string, orda?: boolean, deprecated?: boolean, reviewed?: boolean}> }}
 */
export function loadMapping(file) {
  const doc = YAML.parse(fs.readFileSync(file, 'utf8')) || {};
  const mapping = { schema: doc.schema ?? 1, ignore: doc.ignore || [], mappings: doc.mappings || [] };
  const errors = validateMapping(mapping);
  if (errors.length) {
    const e = new Error(`Invalid mapping file ${file}:\n  - ${errors.join('\n  - ')}`);
    e.errors = errors;
    throw e;
  }
  return mapping;
}

export function validateMapping(mapping) {
  const errors = [];
  const seen = new Set();
  if (!Array.isArray(mapping.mappings)) return ['"mappings" must be a list'];
  mapping.mappings.forEach((m, i) => {
    const where = `mappings[${i}]${m?.command ? ` (${m.command})` : ''}`;
    if (!m || typeof m.command !== 'string' || !m.command.trim()) errors.push(`${where}: missing "command"`);
    else {
      const k = m.command.toLowerCase();
      if (seen.has(k)) errors.push(`${where}: duplicate command`);
      seen.add(k);
    }
    if (!Array.isArray(m?.targets) || !m.targets.length) errors.push(`${where}: "targets" must be a non-empty list`);
    else if (m.targets.some((t) => typeof t !== 'string' || !t.trim())) errors.push(`${where}: targets must be strings`);
    if (!CLASSIFICATIONS.includes(m?.classification)) errors.push(`${where}: classification must be one of ${CLASSIFICATIONS.join(', ')}`);
    for (const b of ['orda', 'deprecated', 'reviewed']) if (m && m[b] !== undefined && typeof m[b] !== 'boolean') errors.push(`${where}: "${b}" must be boolean`);
  });
  for (const c of mapping.ignore || []) if (seen.has(String(c).toLowerCase())) errors.push(`ignore: "${c}" is also mapped`);
  return errors;
}
