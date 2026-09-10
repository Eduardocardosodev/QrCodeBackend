import { writeFileSync } from 'fs';
import { join } from 'path';
import { isDatabaseAvailable } from './database';

export default async function globalSetup() {
  const available = await isDatabaseAvailable();
  writeFileSync(
    join(__dirname, '.e2e-database-available'),
    available ? 'true' : 'false',
  );
}
