const STORAGE_KEY = 'vcid-theme';

export const theme = $state({
  current:
    (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || 'dark',
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
