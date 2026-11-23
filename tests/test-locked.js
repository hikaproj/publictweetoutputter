import { ScrapeTask } from '../lib/task-manager.js';

async function testLocked() {
  console.log('Testing ScrapeTask on locked account @twitter...');
  const task = new ScrapeTask({
    screenName: 'twitter',
    lockedPollingInterval: 3,
    startOnLocked: true,
    retryOnLocked: true
  });

  let waitingObserved = false;

  task.on('log', (log) => {
    console.log(`[TEST LOG] [${log.level}] ${log.message}`);
  });

  task.on('state', (state) => {
    console.log(`[TEST STATE] ${state.state} (retries: ${state.metrics.lockRetries})`);
    if (state.state === 'LOCKED_WAITING') {
      waitingObserved = true;
      if (state.metrics.lockRetries >= 1) {
        console.log('Successfully observed locked waiting and retry polling! Cancelling test.');
        task.cancel();
      }
    }
  });

  await task.run();
  console.log('Test completed. Waiting observed:', waitingObserved);
  process.exit(waitingObserved ? 0 : 1);
}

testLocked().catch(err => {
  console.error(err);
  process.exit(1);
});
