const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { runBackup } = require('./src/backup');
const { captureSoftware } = require('./src/software');
const { scanGitRepos } = require('./src/git-check');
const { generateRestore } = require('./src/restore');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 920,
    minWidth: 600,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });
  mainWindow.loadFile('renderer/index.html');

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer crashed:', details.reason);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile('renderer/index.html');
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

ipcMain.handle('choose-destination', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose backup destination',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('add-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections'],
    title: 'Select folders to back up',
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('add-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections', 'showHiddenFiles'],
    title: 'Select files to back up',
  });
  if (result.canceled) return [];
  return result.filePaths;
});

ipcMain.handle('get-existing-dotfiles', () => {
  const home = os.homedir();
  const candidates = [
    '.zshrc', '.bashrc', '.bash_profile', '.gitconfig', '.vimrc',
    '.ssh', '.gnupg', '.aws', '.kube', '.config',
    '.claude', '.cursor',
  ];
  return candidates.filter(f => {
    try {
      fs.accessSync(path.join(home, f));
      return true;
    } catch {
      return false;
    }
  });
});

function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function createTarArchive(backupDir, backupName, destination, sendLog) {
  return new Promise((resolve) => {
    const tarFile = path.join(destination, `${backupName}.tar.zst`);
    sendLog('\n--- Creating tar archive (zstd compressed) ---');
    sendLog(`  Archive: ${tarFile}`);

    const { spawn } = require('child_process');
    const proc = spawn('tar', ['--zstd', '-cpf', tarFile, '-C', destination, backupName]);

    proc.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) sendLog(`  [tar] ${msg}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        sendLog('--- Tar archive created ---\n');
        resolve(tarFile);
      } else {
        sendLog(`  tar exited with code ${code}`);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      sendLog(`  Failed to create tar archive: ${err.message}`);
      resolve(null);
    });
  });
}

ipcMain.handle('start-backup', async (_event, config) => {
  const { destination, sources, dotfiles, captureSoftwareFlag, createTarFlag } = config;

  const sendLog = (msg) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log', msg);
    }
  };

  try {
    const backupName = `mac-backup-${formatTimestamp()}`;
    const backupDir = path.join(destination, backupName);
    const filesystemDir = path.join(backupDir, 'filesystem');
    fs.mkdirSync(filesystemDir, { recursive: true });

    sendLog(`Backup started: ${backupDir}`);

    const allSources = [...sources];
    const home = os.homedir();
    dotfiles.forEach(df => allSources.push(path.join(home, df)));

    await runBackup(allSources, filesystemDir, sendLog);

    await scanGitRepos(sources, backupDir, sendLog);

    if (captureSoftwareFlag) {
      const manifestDir = path.join(backupDir, 'manifest');
      fs.mkdirSync(manifestDir, { recursive: true });
      await captureSoftware(manifestDir, sendLog);
    }

    await generateRestore(backupDir, captureSoftwareFlag, createTarFlag, sendLog);

    let tarPath = null;
    if (createTarFlag) {
      tarPath = await createTarArchive(backupDir, backupName, destination, sendLog);
    }

    const { execFileSync } = require('child_process');
    let size = 'unknown';
    try {
      const out = execFileSync('du', ['-sh', backupDir], { encoding: 'utf8' }).trim();
      size = out.split('\t')[0];
    } catch { /* ignore */ }

    sendLog(`\n========================================`);
    sendLog(`Backup complete! Total size: ${size}`);
    sendLog(`Location: ${backupDir}`);
    if (tarPath) {
      let tarSize = 'unknown';
      try {
        const out = execFileSync('du', ['-sh', tarPath], { encoding: 'utf8' }).trim();
        tarSize = out.split('\t')[0];
      } catch { /* ignore */ }
      sendLog(`Archive: ${tarPath} (${tarSize})`);
    }
    sendLog(`========================================`);

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-complete', { success: true, path: backupDir, size });
    }
  } catch (err) {
    sendLog(`\nBackup failed: ${err.message}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-complete', { success: false, error: err.message });
    }
  }
});
