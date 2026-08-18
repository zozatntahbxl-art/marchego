/**
 * Prisma exige DATABASE_URL / DIRECT_URL dès `prisma generate`, même sans
 * connexion réelle. Sur Vercel le postinstall tourne parfois avant que les
 * variables du projet soient visibles : on pose des valeurs factices, puis on
 * génère le client dans le même processus.
 *
 * NODE_ENV=development (souvent copié depuis .env.example) fait échouer
 * `next build` : on le force à production sur Vercel.
 */
const { spawnSync } = require('child_process');
const path = require('path');

function prepareEnv() {
  if (process.env.VERCEL) {
    process.env.NODE_ENV = 'production';
  }
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public';
  }
  if (!process.env.DIRECT_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
  }
}

function runPrismaGenerate() {
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
  return result.status === null ? 1 : result.status;
}

function runNextBuild() {
  const nextBin = require.resolve('next/dist/bin/next');
  const result = spawnSync(process.execPath, [nextBin, 'build'], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });
  return result.status === null ? 1 : result.status;
}

prepareEnv();

const mode = process.argv[2] || 'generate';
if (mode === 'build') {
  const gen = runPrismaGenerate();
  if (gen !== 0) process.exit(gen);
  process.exit(runNextBuild());
}

process.exit(runPrismaGenerate());
