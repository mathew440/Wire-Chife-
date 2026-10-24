/** Project-site prefix on GitHub Pages: https://mathew440.github.io/Wire-Chife-/ */
export const BASE_PATH = "/Wire-Chife-";

export function assetPath(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${clean}`;
}

/** App href (`/crew`) → public href (`/Wire-Chife-/crew/`). */
export function withBasePath(href: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = beforeHash.indexOf("?");
  const query = queryAt >= 0 ? beforeHash.slice(queryAt) : "";
  let path = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  if (!path.startsWith("/")) path = `/${path}`;
  if (!(path === BASE_PATH || path.startsWith(`${BASE_PATH}/`))) {
    path = path === "/" ? BASE_PATH : `${BASE_PATH}${path}`;
  }
  if (!path.endsWith("/")) path = `${path}/`;
  return `${path}${query}${hash}`;
}

/** Browser pathname → app pathname, without the Pages prefix or a trailing slash. */
export function appPathname(pathname: string): string {
  let path = pathname;
  if (path === BASE_PATH || path === `${BASE_PATH}/`) return "/";
  if (path.startsWith(`${BASE_PATH}/`)) path = path.slice(BASE_PATH.length);
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  return path || "/";
}
