const { spawn } = require('child_process');
const fs = require('fs');

const EXCLUDES = [
  '.venv', 'venv', 'env', 'node_modules', '__pycache__',
  '.pytest_cache', '.mypy_cache', '.ruff_cache', 'dist', 'build',
  '.next', '.nuxt', 'target', '.gradle', '.DS_Store', '*.pyc',
];

function rsyncSource(source, filesystemDir, sendLog) {
  return new Promise((resolve) => {
    try {
      fs.accessSync(source);
    } catch {
      sendLog(`  Skipping (not found): ${source}`);
      resolve();
      return;
    }

    const args = ['-a', '-h', '-R'];
    EXCLUDES.forEach(ex => args.push('--exclude', ex));
    args.push(source, filesystemDir + '/');

    sendLog(`Copying: ${source}`);

    const proc = spawn('rsync', args);

    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(l => sendLog(`  ${l}`));
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) sendLog(`  [warn] ${msg}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        sendLog(`  Done: ${source}`);
      } else {
        sendLog(`  rsync exited with code ${code} for: ${source}`);
      }
      resolve();
    });

    proc.on('error', (err) => {
      sendLog(`  Failed to copy ${source}: ${err.message}`);
      resolve();
    });
  });
}

async function runBackup(sources, filesystemDir, sendLog) {
  sendLog('\n--- Copying files ---');
  for (const source of sources) {
    await rsyncSource(source, filesystemDir, sendLog);
  }
  sendLog('--- File copying complete ---\n');
}

module.exports = { runBackup };
