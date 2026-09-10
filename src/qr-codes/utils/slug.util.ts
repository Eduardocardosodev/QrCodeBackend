import { randomBytes } from 'crypto';

const SLUG_LENGTH = 8;
const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH);
  let slug = '';

  for (let index = 0; index < SLUG_LENGTH; index += 1) {
    slug += SLUG_ALPHABET[bytes[index] % SLUG_ALPHABET.length];
  }

  return slug;
}
