import { tickAssignmentWorker } from '../lib/assignment/orchestrator';

async function main() {
  const result = await tickAssignmentWorker();
  console.info(JSON.stringify(result));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
