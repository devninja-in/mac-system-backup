# System Backup Tool

A macOS desktop app for creating complete system backups before a reset or migration. Built with Electron.

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Electron](https://img.shields.io/badge/electron-33-blue)

## What It Does

- **Backs up files and folders** — copies selected directories using `rsync`, preserving original absolute paths
- **Backs up dotfiles and configs** — detects and backs up `.zshrc`, `.gitconfig`, `.ssh`, `.aws`, `.kube`, and more
- **Captures installed software** — generates a Brewfile, lists VS Code extensions, npm globals, and pip packages
- **Scans git repositories** — warns about uncommitted changes and unpushed commits that only exist locally
- **Generates restore scripts** — creates a `RESTORE.sh` script and step-by-step `RESTORE-STEPS.md` guide
- **Creates compressed archives** — optionally packages the entire backup as a `.tar.zst` archive

## Prerequisites

- macOS
- [Node.js](https://nodejs.org/) (v18 or later)
- [Homebrew](https://brew.sh/) (optional, for software capture)
- `rsync` (included with macOS)
- `zstd` (for tar compression — install via `brew install zstd`)

## Installation

```bash
git clone git@github.com:devninja-in/mcp-system-backup.git
cd mcp-system-backup
npm install
```

## Usage

### Start the app

```bash
npm start
```

### Steps

1. **Choose a backup destination** — click "Choose destination folder" and select where to save the backup (e.g., an external drive)
2. **Add files and folders** — click "Add folder" or "Add file" to select what you want to back up
3. **Select dotfiles** — the app auto-detects common dotfiles in your home directory; check/uncheck as needed
4. **Configure options**
   - **Capture installed software list** — saves Brewfile, VS Code extensions, npm/pip packages
   - **Create tar archive** — compresses the backup into a single `.tar.zst` file
5. **Click "Start backup"** — monitor progress in the log panel

### Backup output structure

```
mac-backup-YYYYMMDD-HHMMSS/
├── filesystem/              # Backed-up files (preserving original paths)
├── manifest/
│   ├── Brewfile             # Homebrew packages
│   ├── applications-list.txt
│   ├── vscode-extensions.txt
│   ├── npm-global.txt
│   └── pip-global.txt
├── git-status-report.txt    # Git status of all repos at backup time
├── RESTORE.sh               # Automated restore script
└── RESTORE-STEPS.md         # Manual restore guide
```

## Restoring from a backup

### Option 1: Run the restore script

```bash
cd mac-backup-YYYYMMDD-HHMMSS
sudo ./RESTORE.sh
```

This will:
- Copy all files back to their original locations
- Install Homebrew (if missing) and restore packages from the Brewfile
- Reinstall VS Code extensions

### Option 2: Extract from tar archive first

```bash
tar --zstd -xvpf mac-backup-YYYYMMDD-HHMMSS.tar.zst
cd mac-backup-YYYYMMDD-HHMMSS
sudo ./RESTORE.sh
```

### Option 3: Manual restore

```bash
# Restore files
sudo rsync -a filesystem/ /

# Install Homebrew packages
brew bundle --file=manifest/Brewfile

# Install VS Code extensions
cat manifest/vscode-extensions.txt | xargs -L 1 code --install-extension
```

See `RESTORE-STEPS.md` inside the backup for the full step-by-step guide.

## Excluded from backups

The following directories are automatically excluded during file copy to save space:

`node_modules`, `.venv`, `venv`, `env`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `dist`, `build`, `.next`, `.nuxt`, `target`, `.gradle`, `.DS_Store`, `*.pyc`

## License

MIT
