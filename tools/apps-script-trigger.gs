/**
 * ʻIobot updater trigger, run by Google Apps Script on the school account.
 *
 * GitHub's own schedule is "best effort" and in practice runs every 1-5 hours.
 * This script asks GitHub to run the update workflow every 15 minutes during
 * the school day (6:00 am - 7:00 pm Honolulu time, Monday-Friday), which
 * GitHub does right away. Outside those hours GitHub's hourly schedule is
 * enough.
 *
 * Setup (once):
 *   1. Project Settings -> Script Properties -> add GITHUB_TOKEN: a fine-grained
 *      GitHub token for this repository with "Actions: Read and write".
 *   2. Run testOnce() and check the log says 204.
 *   3. Run installTrigger() to start the every-15-minutes schedule.
 */

const REPO = 'dawsony3015-byte/iobot3';
const WORKFLOW = 'update.yml';

/* Called every 15 minutes by the trigger. Skips nights and weekends. */
function runUpdate() {
  const now = new Date();
  const hour = Number(Utilities.formatDate(now, 'Pacific/Honolulu', 'H'));
  const weekday = Number(Utilities.formatDate(now, 'Pacific/Honolulu', 'u')); // 1 = Monday, 7 = Sunday
  if (weekday > 5 || hour < 6 || hour >= 19) return;
  startWorkflow();
}

/* Run this by hand once to check the token works, at any time of day. */
function testOnce() {
  startWorkflow();
}

function startWorkflow() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add GITHUB_TOKEN under Project Settings -> Script Properties first.');
  const response = UrlFetchApp.fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main' }),
    muteHttpExceptions: true,
  });
  // 204 means GitHub accepted it. Anything else is logged so it can be fixed.
  Logger.log(`GitHub answered ${response.getResponseCode()} ${response.getContentText()}`);
}

/* Run this once to create the every-15-minutes trigger (replaces any old one). */
function installTrigger() {
  for (const trigger of ScriptApp.getProjectTriggers()) ScriptApp.deleteTrigger(trigger);
  ScriptApp.newTrigger('runUpdate').timeBased().everyMinutes(15).create();
  Logger.log('Trigger installed: runUpdate every 15 minutes.');
}
