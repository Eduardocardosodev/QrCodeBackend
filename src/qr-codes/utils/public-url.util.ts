export function buildPublicUrl(baseUrl: string, slug: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  return `${normalizedBaseUrl}/redirects/${slug}`;
}
