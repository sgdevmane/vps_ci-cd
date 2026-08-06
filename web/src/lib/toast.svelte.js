export const toasts = $state([]);

let counter = 0;

export function toast(message, kind = 'info') {
  const id = ++counter;
  toasts.push({ id, message, kind });
  setTimeout(() => dismiss(id), 4200);
}

export function toastError(err) {
  toast(err?.message || 'Something went wrong', 'error');
}

export function dismiss(id) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}
