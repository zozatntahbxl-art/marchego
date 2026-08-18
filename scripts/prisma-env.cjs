/**
 * Prisma exige DATABASE_URL / DIRECT_URL dès `prisma generate`, même sans
 * connexion réelle. Sur Vercel le postinstall tourne parfois avant que les
 * variables du projet soient visibles : on pose des valeurs factices, puis on
 * génère le client dans le même processus.
 */
const { spawnSync } = require('child_process');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public';
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

let prismaCli;
try {
  prismaCli = require.resolve('prisma/build/index.js');
} catch {
  process.stderr.write('Prisma CLI introuvable (npm install incomplet).\n');
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCli, 'generate'], {
  stdio: 'inherit',
  env: process.env,
});

process.exit(result.status === null ? 1 : result.status);
