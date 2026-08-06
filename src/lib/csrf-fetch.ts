export function csrfFetch(input: string, init: RequestInit = {}) {
  const match = document.cookie.match(/(?:^|;\s*)kntx_csrf=([^;]+)/);
  const headers = new Headers(init.headers);
  if (match) headers.set("x-csrf-token", decodeURIComponent(match[1]));
  return fetch(input, { ...init, headers });
}
