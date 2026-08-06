export function nowIso() {
  return new Date().toISOString();
}

export function parseList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function indent(text, prefix = '    ') {
  return String(text)
    .split('\n')
    .map((line) => prefix + line)
    .join('\n');
}
