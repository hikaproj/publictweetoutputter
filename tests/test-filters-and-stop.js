import { ScrapeTask } from '../lib/task-manager.js';

async function testFiltersAndStop() {
  console.log('Testing date filters, oldest-first, and stopAndExport...');
  
  const task = new ScrapeTask({
    screenName: 'jack',
    direction: 'oldest',
    includeReplies: false,
    includeReposts: false,
    includeQuotes: false,
    includeOriginals: true,
    downloadImages: false,
    downloadVideos: false,
    exportFormat: 'zip',
    maxTweets: 10
  });

  task.on('log', (log) => {
    console.log(`[FILTER TEST] [${log.level}] ${log.message}`);
  });

  // Test stopAndExport midway
  let tweetCount = 0;
  task.on('tweet', () => {
    tweetCount++;
    if (tweetCount === 5) {
      console.log('5 matching original tweets received. Triggering stopAndExport()...');
      task.stopAndExport();
    }
  });

  await task.run();

  console.log('Final collected tweets count:', task.tweets.length);
  console.log('Archive result exists:', Boolean(task.archiveResult));
  
  // Verify tweets are all originals (no reply, no repost, no quote)
  const allOriginals = task.tweets.every(t => !t.replying_to && !t.reposted_by && !t.quote);
  console.log('All tweets are strictly original:', allOriginals);

  // Verify timestamps are in chronological (oldest-first) order
  let sortedChronologically = true;
  for (let i = 1; i < task.tweets.length; i++) {
    if ((task.tweets[i].created_timestamp || 0) < (task.tweets[i - 1].created_timestamp || 0)) {
      sortedChronologically = false;
      break;
    }
  }
  console.log('Tweets sorted oldest-first:', sortedChronologically);

  const success = task.tweets.length >= 5 && allOriginals && sortedChronologically && Boolean(task.archiveResult);
  console.log('Filters & Stop Test Passed:', success);
  process.exit(success ? 0 : 1);
}

testFiltersAndStop().catch(err => {
  console.error(err);
  process.exit(1);
});
