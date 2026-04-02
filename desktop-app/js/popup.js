let API_URL = 'https://revolution-backend-sal2.onrender.com';
async function resolveApiUrl() {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(()=>ctrl.abort(), 800);
    const r = await fetch('http://localhost:3000/health', { signal: ctrl.signal });
    clearTimeout(id);
    if (r.ok) {
      API_URL = 'http://localhost:3000';
      await chrome.storage.local.set({ api_url: API_URL });
      return;
    }
  } catch {}
  const stored = await chrome.storage.local.get(['api_url']);
  if (stored.api_url) API_URL = stored.api_url;
}

let token = null;
let updateInterval = null;

// DOM elements
const loginSection = document.getElementById('loginSection');
const dashboardSection = document.getElementById('dashboardSection');
const loginBtn = document.getElementById('loginBtn');
const errorMsg = document.getElementById('errorMsg');
const toggleBtn = document.getElementById('toggleBtn');
const toggleIcon = document.getElementById('toggleIcon');
const logoutBtn = document.getElementById('logoutBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const sessionPoints = document.getElementById('sessionPoints');
const terminalLogs = document.getElementById('terminalLogs');

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  await resolveApiUrl();
  const stored = await chrome.storage.local.get(['token', 'user']);
  if (stored.token) {
    token = stored.token;
    showDashboard();
    startStatusUpdates();
    return;
  }
  try {
    const found = await syncWithSite();
    if (found && found.token) {
      token = found.token;
      await chrome.storage.local.set({ token: found.token, refreshToken: found.refreshToken || null, user: found.user || null });
      showDashboard();
      startStatusUpdates();
      return;
    }
  } catch {}
  showLogin();
});

// Sign in
loginBtn.addEventListener('click', async () => {
  try {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    errorMsg.textContent = '';
    const found = await syncWithSite(true);
    if (found && found.token) {
      token = found.token;
      await chrome.storage.local.set({ token: found.token, refreshToken: found.refreshToken || null, user: found.user || null });
      showDashboard();
      startStatusUpdates();
    } else {
      errorMsg.textContent = 'Please sign in on the website, then try again.';
    }
  } catch (error) {
    errorMsg.textContent = error.message || 'Sign-in error';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in via website';
  }
});

// Sign out
logoutBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'stop' });
  await chrome.storage.local.remove(['token', 'user', 'isActive', 'sessionId']);
  token = null;
  showLogin();
  stopStatusUpdates();
});

// Toggle mining (Play/Pause)
if (toggleBtn) {
  toggleBtn.addEventListener('click', async () => {
    toggleBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'getStatus' }, (state) => {
      if (state && state.isActive) {
        chrome.runtime.sendMessage({ action: 'stop' }, () => {
          toggleBtn.disabled = false;
          updateUI();
        });
      } else {
        chrome.runtime.sendMessage({ action: 'start', token }, () => {
          toggleBtn.disabled = false;
          updateUI();
        });
      }
    });
  });
}

// No VPN toggle for now

function showLogin() {
  loginSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
}

function showDashboard() {
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  updateUI();
}

function startStatusUpdates() {
  if (updateInterval) clearInterval(updateInterval);
  updateUI();
  updateInterval = setInterval(updateUI, 1000);
}

function stopStatusUpdates() {
  if (updateInterval) clearInterval(updateInterval);
}

async function syncWithSite(openIfMissing=false) {
  const targets = [
    'http://localhost:3001/*',
    'https://revolution-network.fr/*',
    'https://www.revolution-network.fr/*',
    'https://azurus333.github.io/Revolution-Network/*'
  ];
  let tabs = [];
  for (const t of targets) {
    const r = await chrome.tabs.query({ url: t });
    if (r && r.length) { tabs = r; break; }
  }
  if (!tabs || tabs.length === 0) {
    if (openIfMissing) {
      const url = 'https://revolution-network.fr/';
      const t = await chrome.tabs.create({ url });
      
      // Wait for tab to finish loading to avoid "Frame with ID 0 is showing error page"
      await new Promise(resolve => {
        const listener = (tabId, changeInfo) => {
          if (tabId === t.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      
      tabs = [t];
    } else {
      return null;
    }
  }
  const tabId = tabs[0].id;
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      let user = null;
      try {
        const u = localStorage.getItem('user');
        if (u) user = JSON.parse(u);
      } catch {}
      return {
        token: localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refreshToken'),
        user
      };
    }
  });
  const res = results && results[0] ? results[0].result : null;
  if (!res || !res.token) return null;
  let profile = null;
  try {
    const r = await fetch(`${API_URL}/api/user/profile`, { headers: { 'Authorization': `Bearer ${res.token}` }});
    if (r.ok) {
      const j = await r.json();
      profile = j.user || null;
    }
  } catch {}
  return { token: res.token, refreshToken: res.refreshToken || null, user: profile || res.user || null };
}

function updateUI() {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (!response) return;

    if (response.isActive) {
      statusDot.className = 'dot active';
      statusText.textContent = 'ACTIVE';
      statusText.style.color = '#00ff9d';
      if (toggleBtn && toggleIcon) {
        toggleBtn.classList.add('pause');
        toggleIcon.textContent = '⏸';
        toggleBtn.title = 'Pause';
      }
    } else {
      statusDot.className = 'dot inactive';
      statusText.textContent = 'INACTIVE';
      statusText.style.color = '#ff4444';
      if (toggleBtn && toggleIcon) {
        toggleBtn.classList.remove('pause');
        toggleIcon.textContent = '▶';
        toggleBtn.title = 'Start';
      }
    }

    if (response.points !== undefined) {
      sessionPoints.textContent = response.points;
    }

    if (response.logs && response.logs.length > 0) {
        // Clear old logs if needed or just append new ones?
        // Since we get full array (limit 20), we can rebuild
        terminalLogs.innerHTML = '';
        response.logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'log-entry';
            div.innerHTML = `<span class="log-time">[${new Date(log.time).toLocaleTimeString()}]</span> ${log.msg}`;
            terminalLogs.appendChild(div);
        });
        terminalLogs.scrollTop = terminalLogs.scrollHeight;
    }
    // VPN UI removed for now
  });
}
