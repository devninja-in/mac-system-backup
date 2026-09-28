const backupApi = window.api;

let destination = null;
let sources = [];

const destBtn = document.getElementById('choose-dest');
const destPath = document.getElementById('dest-path');
const addFolderBtn = document.getElementById('add-folder');
const addFileBtn = document.getElementById('add-file');
const sourcesList = document.getElementById('sources-list');
const sourcesEmpty = document.getElementById('sources-empty');
const dotfilesGrid = document.getElementById('dotfiles-grid');
const dotfilesEmpty = document.getElementById('dotfiles-empty');
const captureSoftware = document.getElementById('capture-software');
const createTar = document.getElementById('create-tar');
const startBtn = document.getElementById('start-backup');
const logSection = document.getElementById('log-section');
const logArea = document.getElementById('log-area');

function updateStartBtn() {
  const hasDotfiles = dotfilesGrid.querySelectorAll('input:checked').length > 0;
  startBtn.disabled = !destination || (sources.length === 0 && !hasDotfiles);
}

function renderSources() {
  sourcesList.innerHTML = '';
  sourcesEmpty.classList.toggle('hidden', sources.length > 0);
  sources.forEach((src, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = src;
    span.title = src;
    const btn = document.createElement('button');
    btn.className = 'remove-btn';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      sources.splice(i, 1);
      renderSources();
      updateStartBtn();
    });
    li.appendChild(span);
    li.appendChild(btn);
    sourcesList.appendChild(li);
  });
}

async function initDotfiles() {
  const existing = await backupApi.getExistingDotfiles();
  dotfilesEmpty.classList.add('hidden');
  if (existing.length === 0) {
    dotfilesEmpty.textContent = 'No common dotfiles found.';
    dotfilesEmpty.classList.remove('hidden');
    return;
  }
  existing.forEach(df => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.dotfile = df;
    cb.addEventListener('change', updateStartBtn);
    const text = document.createTextNode(df);
    label.appendChild(cb);
    label.appendChild(text);
    dotfilesGrid.appendChild(label);
  });
}

initDotfiles();

destBtn.addEventListener('click', async () => {
  const chosen = await backupApi.chooseDestination();
  if (chosen) {
    destination = chosen;
    destPath.textContent = chosen;
    destPath.classList.add('active');
    updateStartBtn();
  }
});

addFolderBtn.addEventListener('click', async () => {
  const paths = await backupApi.addFolder();
  paths.forEach(p => { if (!sources.includes(p)) sources.push(p); });
  renderSources();
  updateStartBtn();
});

addFileBtn.addEventListener('click', async () => {
  const paths = await backupApi.addFile();
  paths.forEach(p => { if (!sources.includes(p)) sources.push(p); });
  renderSources();
  updateStartBtn();
});

function setUIEnabled(enabled) {
  destBtn.disabled = !enabled;
  addFolderBtn.disabled = !enabled;
  addFileBtn.disabled = !enabled;
  captureSoftware.disabled = !enabled;
  createTar.disabled = !enabled;
  dotfilesGrid.querySelectorAll('input').forEach(cb => cb.disabled = !enabled);
  sourcesList.querySelectorAll('.remove-btn').forEach(b => b.disabled = !enabled);
}

startBtn.addEventListener('click', async () => {
  const selectedDotfiles = Array.from(
    dotfilesGrid.querySelectorAll('input:checked')
  ).map(cb => cb.dataset.dotfile);

  startBtn.disabled = true;
  startBtn.textContent = 'Backing up…';
  setUIEnabled(false);

  logSection.classList.remove('hidden');
  logArea.textContent = '';

  await backupApi.startBackup({
    destination,
    sources,
    dotfiles: selectedDotfiles,
    captureSoftwareFlag: captureSoftware.checked,
    createTarFlag: createTar.checked,
  });
});

const MAX_LOG_LINES = 500;

backupApi.onLog((msg) => {
  const line = document.createElement('span');
  line.textContent = msg + '\n';

  if (/WARNING|⚠/.test(msg)) {
    line.className = 'log-warn';
  } else if (/failed|Error|✗/.test(msg)) {
    line.className = 'log-err';
  } else if (/complete|Done|✓|========/.test(msg)) {
    line.className = 'log-ok';
  }

  logArea.appendChild(line);

  while (logArea.childNodes.length > MAX_LOG_LINES) {
    logArea.removeChild(logArea.firstChild);
  }

  logArea.scrollTop = logArea.scrollHeight;
});

backupApi.onBackupComplete((result) => {
  if (result.success) {
    startBtn.textContent = 'Backup complete!';
    startBtn.style.background = '#30d158';
  } else {
    startBtn.textContent = 'Backup failed';
    startBtn.style.background = '#ff453a';
  }

  setTimeout(() => {
    startBtn.textContent = 'Start backup';
    startBtn.style.background = '';
    startBtn.disabled = false;
    setUIEnabled(true);
    updateStartBtn();
  }, 4000);
});
