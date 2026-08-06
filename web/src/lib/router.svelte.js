function parse() {
  const hash = window.location.hash.slice(1) || '/';
  const [rawPath, rawQuery] = hash.split('?');
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return {
    path,
    segments: path.split('/').filter(Boolean),
    query: new URLSearchParams(rawQuery || ''),
  };
}

export const route = $state(parse());

window.addEventListener('hashchange', () => {
  Object.assign(route, parse());
});

export function navigate(path) {
  if (window.location.hash.slice(1) === path) {
    Object.assign(route, parse());
    return;
  }
  window.location.hash = path;
}

export function replace(path) {
  const url = `${window.location.pathname}${window.location.search}#${path}`;
  window.history.replaceState(null, '', url);
  Object.assign(route, parse());
}
