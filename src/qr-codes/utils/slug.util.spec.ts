import { generateSlug } from './slug.util';

describe('generateSlug', () => {
  it('deve gerar slug com 8 caracteres', () => {
    const slug = generateSlug();

    expect(slug).toHaveLength(8);
    expect(slug).toMatch(/^[a-z0-9]+$/);
  });

  it('deve gerar slugs diferentes', () => {
    const slugA = generateSlug();
    const slugB = generateSlug();

    expect(slugA).not.toBe(slugB);
  });
});
