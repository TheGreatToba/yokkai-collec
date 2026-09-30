export function cardSearchTerms(query: string): string[] {
  return query.replace(/[,%()]/g, " ").trim().toLocaleLowerCase("fr-FR").split(/\s+/).filter(Boolean);
}

export function matchesCardSearch(query: string, values: (string | null | undefined)[]): boolean {
  const terms = cardSearchTerms(query);
  if (!terms.length) return true;
  const searchable = values.map(value => value?.toLocaleLowerCase("fr-FR") ?? "");
  return terms.every(term => searchable.some(value => value.includes(term)));
}
