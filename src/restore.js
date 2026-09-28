const fs = require('fs');
const path = require('path');

async function generateRestore(backupDir, hasSoftwareCapture, hasTar, sendLog) {
  sendLog('\n--- Generating restore files ---');

  const manifestDir = path.join(backupDir, 'manifest');
  const hasBrewfile = hasSoftwareCapture && fs.existsSync(path.join(manifestDir, 'Brewfile'));
  const hasVSCodeExts = hasSoftwareCapture && fs.existsSync(path.join(manifestDir, 'vscode-extensions.txt'));

  writeRestoreScript(backupDir, hasBrewfile, hasVSCodeExts, sendLog);
  writeRestoreSteps(backupDir, hasBrewfile, hasVSCodeExts, hasTar, sendLog);

  sendLog('--- Restore files generated ---\n');
}

function writeRestoreScript(backupDir, hasBrewfile, hasVSCodeExts, sendLog) {
  let sh = `#!/bin/bash
set -euo pipefail

BACKUP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== System Restore ==="
echo "Restoring from: $BACKUP_DIR"
echo ""

# Restore files
if [ -d "$BACKUP_DIR/filesystem" ]; then
  echo "Restoring files to original locations..."
  sudo rsync -a "$BACKUP_DIR/filesystem/" /
  echo "Files restored."
else
  echo "No filesystem directory found, skipping file restore."
fi
echo ""
`;

  if (hasBrewfile) {
    sh += `
# Install Homebrew if missing
if ! command -v brew &>/dev/null; then
  echo "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install packages from Brewfile
if [ -f "$BACKUP_DIR/manifest/Brewfile" ]; then
  echo "Installing Homebrew packages..."
  brew bundle --file="$BACKUP_DIR/manifest/Brewfile"
  echo "Homebrew packages installed."
fi
echo ""
`;
  }

  if (hasVSCodeExts) {
    sh += `
# Install VS Code extensions
if command -v code &>/dev/null && [ -f "$BACKUP_DIR/manifest/vscode-extensions.txt" ]; then
  echo "Installing VS Code extensions..."
  while IFS= read -r ext; do
    [ -z "$ext" ] && continue
    code --install-extension "$ext" || true
  done < "$BACKUP_DIR/manifest/vscode-extensions.txt"
  echo "VS Code extensions installed."
else
  echo "VS Code not found. Install it, then run:"
  echo "  cat $BACKUP_DIR/manifest/vscode-extensions.txt | xargs -L 1 code --install-extension"
fi
echo ""
`;
  }

  sh += `
echo "=== Restore complete ==="
echo "See RESTORE-STEPS.md for manual steps (rebuilding project deps, etc.)"
`;

  const scriptPath = path.join(backupDir, 'RESTORE.sh');
  fs.writeFileSync(scriptPath, sh);
  fs.chmodSync(scriptPath, '755');
  sendLog('  RESTORE.sh written');
}

function writeRestoreSteps(backupDir, hasBrewfile, hasVSCodeExts, hasTar, sendLog) {
  let step = 1;

  let md = `# Restore Steps\n\n> Generated: ${new Date().toISOString()}\n`;

  if (hasTar) {
    const backupName = path.basename(backupDir);
    md += `\n## ${step}. Extract the tar archive\n\n`;
    md += `If you have the \`.tar.zst\` archive, extract it first:\n\n`;
    md += '```bash\n';
    md += `tar --zstd -xvpf ${backupName}.tar.zst\n`;
    md += '```\n\n';
    md += `This recreates the \`${backupName}/\` directory with all backup contents.\n`;
    md += `Then \`cd\` into it and continue with the steps below.\n`;
    step++;
  }

  md += `\n## ${step}. Restore backed-up files\n\n`;
  md += `The \`filesystem/\` directory mirrors each file's original absolute path.\n`;
  md += `Run the restore script to copy everything back:\n\n`;
  md += '```bash\nsudo ./RESTORE.sh\n```\n\n';
  md += `Or manually:\n\n`;
  md += '```bash\nsudo rsync -a filesystem/ /\n```\n\n';
  md += `This merges files into your filesystem without overwriting anything else.\n`;
  step++;

  md += `\n## ${step}. Install Homebrew\n\n`;
  md += '```bash\n/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"\n```\n';
  step++;

  if (hasBrewfile) {
    md += `\nThen reinstall all packages:\n\n`;
    md += '```bash\nbrew bundle --file=manifest/Brewfile\n```\n\n';
    md += `This handles formulae, casks, and Mac App Store apps.\n`;
  }

  if (hasVSCodeExts) {
    md += `\n## ${step}. Reinstall VS Code extensions\n\n`;
    md += '```bash\ncat manifest/vscode-extensions.txt | xargs -L 1 code --install-extension\n```\n';
    step++;
  }

  md += `\n## ${step}. Rebuild project dependencies\n\n`;
  md += `Each project's lockfile is in the backup. Rebuild from it:\n\n`;
  md += `**Python** (requirements.txt):\n`;
  md += '```bash\ncd /path/to/project\npython -m venv .venv\nsource .venv/bin/activate\npip install -r requirements.txt\n```\n\n';
  md += `**Node.js** (package.json):\n`;
  md += '```bash\ncd /path/to/project\nnpm install\n```\n\n';
  md += `Check each project's README for other setup steps.\n`;
  step++;

  md += `\n## ${step}. Check git status report\n\n`;
  md += `Review \`git-status-report.txt\` for any repos that had uncommitted\n`;
  md += `changes or unpushed commits at backup time.\n`;

  md += `\n---\n\n## What's in this backup\n\n`;
  md += `| Path | Contents |\n|------|----------|\n`;
  md += '| `filesystem/` | Backed-up files, preserving original absolute paths |\n';
  md += '| `git-status-report.txt` | Git status of all repos at backup time |\n';

  if (hasBrewfile) md += '| `manifest/Brewfile` | Homebrew formulae, casks, and MAS apps |\n';
  md += '| `manifest/applications-list.txt` | Installed applications |\n';
  if (hasVSCodeExts) md += '| `manifest/vscode-extensions.txt` | VS Code extensions |\n';
  md += '| `manifest/npm-global.txt` | Global npm packages |\n';
  md += '| `manifest/pip-global.txt` | Global pip3 packages |\n';

  fs.writeFileSync(path.join(backupDir, 'RESTORE-STEPS.md'), md);
  sendLog('  RESTORE-STEPS.md written');
}

module.exports = { generateRestore };
