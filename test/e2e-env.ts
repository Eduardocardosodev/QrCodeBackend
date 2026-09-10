import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export function isE2EDatabaseAvailable(): boolean {
  const markerPath = join(__dirname, '.e2e-database-available');

  if (!existsSync(markerPath)) {
    return false;
  }

  return readFileSync(markerPath, 'utf8').trim() === 'true';
}
