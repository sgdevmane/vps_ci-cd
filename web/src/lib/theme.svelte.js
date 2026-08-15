const STORAGE_KEY = 'vcid-theme';

function preferredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* storage unavailable */
  }
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export const theme = $state({
  current: preferredTheme(),
});

export function applyTheme() {
  document.documentElement.dataset.theme = theme.current;
}

export function toggleTheme() {
  theme.current = theme.current === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEY, theme.current);
  applyTheme();
}

export function initTheme() {
  applyTheme();
}
