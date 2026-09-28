const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

function findGitRepos(dirs) {
  const repos = new Set();
  for (const dir of dirs) {
    try {
      fs.accessSync(dir);
    } catch {
      continue;
    }
    try {
      const output = execFileSync('find', [
        dir, '-name', '.git', '-type', 'd',
        '-not', '-path', '*/node_modules/*',
        '-not', '-path', '*/.venv/*',
        '-not', '-path', '*/venv/*',
      ], { encoding: 'utf8', timeout: 30000 });
      output.split('\n').filter(l => l.trim()).forEach(gitDir => {
        repos.add(path.dirname(gitDir));
      });
    } catch {
      // find may fail on permission errors, continue
    }
  }
  return [...repos];
}

function runGit(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return '';
  }
}

async function scanGitRepos(sources, backupDir, sendLog) {
  sendLog('\n--- Scanning git repositories ---');

  if (sources.length === 0) {
    sendLog('No source folders to scan for git repos.');
    return;
  }

  const repos = findGitRepos(sources);

  if (repos.length === 0) {
    sendLog('No git repositories found in selected sources.');
    return;
  }

  sendLog(`Found ${repos.length} git repo(s).`);

  let report = 'Git Status Report\n';
  report += '='.repeat(60) + '\n';
  report += `Generated: ${new Date().toISOString()}\n\n`;

  let hasLocalOnly = false;

  for (const repo of repos) {
    const status = runGit(['status', '-s'], repo);
    const unpushed = runGit(['log', '--branches', '--not', '--remotes', '--oneline'], repo);
    const stashes = runGit(['stash', 'list'], repo);

    report += `Repository: ${repo}\n`;
    report += '-'.repeat(60) + '\n';

    report += 'Uncommitted changes: ';
    if (status) {
      report += `\n${status}\n`;
      hasLocalOnly = true;
    } else {
      report += 'None\n';
    }

    report += '\nUnpushed commits: ';
    if (unpushed) {
      report += `\n${unpushed}\n`;
      hasLocalOnly = true;
    } else {
      report += 'None\n';
    }

    report += '\nStashes: ';
    if (stashes) {
      report += `\n${stashes}\n`;
    } else {
      report += 'None\n';
    }

    report += '\n\n';
  }

  const reportPath = path.join(backupDir, 'git-status-report.txt');
  fs.writeFileSync(reportPath, report);
  sendLog('Git status report written.');

  if (hasLocalOnly) {
    sendLog('');
    sendLog('==================================================');
    sendLog('WARNING: Some repos have uncommitted changes or');
    sendLog('unpushed commits that ONLY EXIST ON THIS MACHINE.');
    sendLog('Push them before resetting!');
    sendLog('See git-status-report.txt for details.');
    sendLog('==================================================');
    sendLog('');
  }
}

module.exports = { scanGitRepos };
