/** Hash routes are used by the portable demo; hosted app routes use the URL query. */
export function browserWorkspaceSearch(location: Pick<Location, "hash" | "href" | "search">): string {
  return location.hash.startsWith("#/") ? new URL(location.hash.slice(1), location.href).search : location.search;
}
