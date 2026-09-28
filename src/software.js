const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function commandExists(cmd) {
  try {
    execFileSync('which', [cmd], { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function runCapture(cmd, args, outFile, label, sendLog) {
  sendLog(`Capturing ${label}...`);
  try {
    const output = execFileSync(cmd, args, { encoding: 'utf8', timeout: 120000 });
    fs.writeFileSync(outFile, output);
    sendLog(`  ${label} saved`);
  } catch (err) {
    sendLog(`  ${label} failed: ${err.message}`);
  }
}

async function captureSoftware(manifestDir, sendLog) {
  sendLog('\n--- Capturing installed software ---');

  if (commandExists('brew')) {
    sendLog('Dumping Brewfile...');
    try {
      const brewfilePath = path.join(manifestDir, 'Brewfile');
      execFileSync('brew', ['bundle', 'dump', '--describe', '--force', '--file', brewfilePath], {
        encoding: 'utf8',
        timeout: 120000,
      });
      sendLog('  Brewfile saved');
    } catch (err) {
      sendLog(`  Brewfile failed: ${err.message}`);
    }
  } else {
    sendLog('  Homebrew not found, skipping.');
  }

  try {
    sendLog('Listing /Applications...');
    const apps = execFileSync('ls', ['/Applications'], { encoding: 'utf8' });
    fs.writeFileSync(path.join(manifestDir, 'applications-list.txt'), apps);
    sendLog('  applications-list.txt saved');
  } catch (err) {
    sendLog(`  Applications list failed: ${err.message}`);
  }

  if (commandExists('code')) {
    runCapture('code', ['--list-extensions'],
      path.join(manifestDir, 'vscode-extensions.txt'), 'VS Code extensions', sendLog);
  } else {
    sendLog('  VS Code CLI not found, skipping.');
  }

  if (commandExists('npm')) {
    runCapture('npm', ['list', '-g', '--depth=0'],
      path.join(manifestDir, 'npm-global.txt'), 'npm globals', sendLog);
  } else {
    sendLog('  npm not found, skipping.');
  }

  if (commandExists('pip3')) {
    runCapture('pip3', ['list'],
      path.join(manifestDir, 'pip-global.txt'), 'pip3 packages', sendLog);
  } else {
    sendLog('  pip3 not found, skipping.');
  }

  sendLog('--- Software capture complete ---\n');
}

module.exports = { captureSoftware };
