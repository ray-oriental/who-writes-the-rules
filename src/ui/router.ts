import { useEffect, useState } from 'react';

/** Hash routes. Works from file:// and under any GitHub Pages path. */
export type Route =
  | { name: 'play' }
  | { name: 'gallery' }
  | { name: 'research'; delegation?: string; recordId?: string }
  | { name: 'delegations'; id?: string; isNew?: boolean }
  | { name: 'print' }
  | { name: 'settings' }
  | { name: 'admin' }
  | { name: 'dev' }
  | { name: 'not_found'; path: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/\/+$/, '') || '/';
  let parts: string[];
  try {
    parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { name: 'not_found', path };
  }
  if (parts.length === 0) return { name: 'play' };
  switch (parts[0]) {
    case 'gallery':
      return { name: 'gallery' };
    case 'research':
      if (parts[2]) return { name: 'research', delegation: parts[1], recordId: parts[2] };
      return parts[1] ? { name: 'research', delegation: parts[1] } : { name: 'research' };
    case 'delegations':
      if (parts[1] === 'new') return { name: 'delegations', isNew: true };
      return parts[1] ? { name: 'delegations', id: parts[1] } : { name: 'delegations' };
    case 'print':
      return { name: 'print' };
    case 'settings':
      return { name: 'settings' };
    case 'admin':
      return { name: 'admin' };
    case 'dev':
      return { name: 'dev' };
    default:
      return { name: 'not_found', path };
  }
}

/** Build an href: href('research', 'china') -> "#/research/china". */
export function href(...parts: string[]): string {
  return `#/${parts.map(encodeURIComponent).join('/')}`;
}

export function navigate(to: string): void {
  const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : `/${to}`}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
