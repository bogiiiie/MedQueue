// ── EmailJS ──
const EMAILJS_PUBLIC_KEY = 'VGT84EnFa0OcMMxcs';
const EMAILJS_SERVICE_ID = 'service_pssc8fl';
const EMAILJS_ALMOST_TURN_TMPL = 'template_u0ytxfe';   // Almost your turn email
const EMAILJS_TURN_TMPL = 'template_ebi2swf';          // Your turn email

emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================================
// VARIABLES - declared once at the top
// ============================================================
let myStaffCounter = null;
let myStaffDepartment = null;
let isCounterClosed = false;

// ============================================================
// STAFF INFO
// ============================================================
async function getMyStaffInfo() {
  try {
    const res = await fetch('/api/auth/check', { credentials: 'include' });
    const data = await res.json();
    if (data.authenticated && data.staff) {
      myStaffCounter = data.staff.counter;
      myStaffDepartment = data.staff.department;
      console.log(`Logged in as: Counter ${myStaffCounter} - ${myStaffDepartment}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to get staff info:', err);
    return false;
  }
}

// ============================================================
// LOAD DASHBOARD DATA
// ============================================================
async function loadDashboard() {
  try {
    if (!myStaffCounter) {
      await getMyStaffInfo();
    }

    const res = await fetch('/api/queue/list');
    const result = await res.json();
    if (!result.success) return;

    const allQueues = result.queues;
    const myQueues = allQueues.filter(q => String(q.assigned_counter) === String(myStaffCounter));

    const serving = myQueues.find(q => q.status === 'Serving');
    const waiting = myQueues.filter(q => q.status === 'Waiting');

    renderQueueTable(myQueues);

    if (serving) {
      const now = new Date();
      const startTime = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

      updateNowServing(
        serving.queue_number,
        serving.patient_name,
        serving.department || '—',
        serving.counter || '—',
        startTime
      );
      updateCurrentPatientPanel(serving);
    } else {
      updateNowServing('—', 'No patient serving', '—', '—', '—');
      updateCurrentPatientPanel(null);
    }

    updateRemainingCount(waiting.length);
    updateStats(myQueues);

    console.log('My staff counter:', myStaffCounter);
    console.log('Filtered my queues:', myQueues);

  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================
function renderQueueTable(queues) {
  const tbody = document.querySelector('#queue-panel tbody');
  if (!tbody) return;

  if (queues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center py-8 text-gray-400">No patients for your counter</td></tr>`;
    return;
  }

  tbody.innerHTML = queues.map(q => {
    const isServing = q.status === 'Serving';
    const isCompleted = q.status === 'Completed' || q.status === 'Skipped';

    let badge = '';
    if (isServing) {
      badge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-[#EFF5FF] text-[#0052CC] border border-blue-200">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#0066FF]" aria-hidden="true"></span>
        Now Serving
      </span>`;
    } else if (q.status === 'Completed') {
      badge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-green-50 text-green-700 border border-green-200">Completed</span>`;
    } else if (q.status === 'Skipped') {
      badge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-orange-50 text-orange-700 border border-orange-200">No Show</span>`;
    } else {
      badge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-gray-50 text-gray-500 border border-gray-200">Waiting</span>`;
    }

    return `<tr class="border-b border-gray-100 last:border-0 ${isServing ? 'border-l-2 border-l-[#0066FF] bg-[#EFF5FF]' : ''}" ${isServing ? 'aria-current="true"' : ''}>
      <td class="py-2.5 pr-4 ${isServing ? 'pl-2.5' : ''} font-mono text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-900'}">${q.queue_number}</td>
      <td class="py-2.5 pr-4 text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}">${q.patient_name || '—'}</td>
      <td class="py-2.5">${badge}</td>
     </tr>`;
  }).join('');
}

function updateCurrentPatientPanel(patient) {
  const queueDisplay = document.querySelector('#current-patient-panel p.font-mono.text-\\[32px\\]');
  const dds = document.querySelectorAll('#current-patient-panel dl dd');

  if (!patient) {
    if (queueDisplay) queueDisplay.textContent = '—';
    if (dds[0]) dds[0].textContent = '—';
    if (dds[1]) dds[1].textContent = '—';
    if (dds[2]) dds[2].textContent = '—';
    if (dds[3]) dds[3].textContent = '—';
    if (dds[4]) dds[4].textContent = '—';
    return;
  }

  if (queueDisplay) queueDisplay.textContent = patient.queue_number || '—';
  if (dds[0]) dds[0].textContent = patient.patient_name || '—';
  if (dds[1]) {
    const masked = patient.mobile_number
      ? patient.mobile_number.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 *** $3')
      : '—';
    dds[1].textContent = masked;
  }
  if (dds[2]) dds[2].textContent = patient.department || '—';
  if (dds[3]) dds[3].textContent = patient.counter || '—';
  if (dds[4]) {
    const time = patient.created_at
      ? new Date(patient.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
      : '—';
    dds[4].textContent = time;
  }
}

function updateRemainingCount(count) {
  const badge = document.querySelector('#queue-panel .bg-\\[\\#EFF5FF\\]');
  if (badge) badge.textContent = `${count} remaining`;
}

function updateStats(queues) {
  const total = queues.length;
  const served = queues.filter(q => q.status === 'Completed').length;
  const noShows = queues.filter(q => q.status === 'Skipped').length;

  const statDds = document.querySelectorAll('#today-stats-panel dd');
  if (statDds[0]) statDds[0].textContent = total;
  if (statDds[1]) statDds[1].textContent = served;
  if (statDds[2]) statDds[2].textContent = noShows;
}

// ============================================================
// CALL NEXT BUTTON (with counter closed check)
// ============================================================
const callNextBtn = document.querySelector('#queue-panel button');

if (callNextBtn) {
  callNextBtn.addEventListener('click', async () => {
    if (isCounterClosed) {
      alert('Counter is closed. Please open counter first to call next patient.');
      return;
    }
    
    callNextBtn.disabled = true;
    callNextBtn.textContent = 'Calling...';

    try {
      const response = await fetch('/api/queue/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'call_next',
          staff_counter: myStaffCounter
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to call next patient');
      } else {
        loadDashboard();
      }

    } catch (err) {
      console.error('Call Next failed:', err);
      alert('Failed to call next patient');
    } finally {
      callNextBtn.disabled = false;
      callNextBtn.innerHTML = `Call Next
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6"/>
        </svg>`;
    }
  });
}

// ============================================================
// COMPLETE BUTTON
// ============================================================
const completeBtn = document.querySelector('#now-serving-panel button.bg-green-600');

if (completeBtn) {
  completeBtn.addEventListener('click', async () => {
    const nowServing = document.querySelector('#now-serving-heading').textContent.trim();
    if (!nowServing || nowServing === '—') return;

    completeBtn.disabled = true;
    try {
      const res = await fetch('/api/queue/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', queue_number: nowServing }),
      });

      if (res.ok) {
        showCompleteNotif(nowServing);
        loadDashboard();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to complete.');
      }
    } catch (err) {
      console.error('Complete failed:', err);
    } finally {
      completeBtn.disabled = false;
    }
  });
}

// ============================================================
// SKIP BUTTON
// ============================================================
const skipBtn = document.querySelector('#now-serving-panel button[style*="rgb(234, 108, 0)"]');

if (skipBtn) {
  skipBtn.addEventListener('click', async () => {
    const nowServing = document.querySelector('#now-serving-heading').textContent.trim();
    if (!nowServing || nowServing === '—') return;

    const confirmed = window.confirm('Mark this patient as No Show / Skip?');
    if (!confirmed) return;

    skipBtn.disabled = true;
    try {
      const res = await fetch('/api/queue/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip', queue_number: nowServing }),
      });

      if (res.ok) {
        showSkipNotif(nowServing);
        loadDashboard();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to skip.');
      }
    } catch (err) {
      console.error('Skip failed:', err);
    } finally {
      skipBtn.disabled = false;
    }
  });
}

function showSkipNotif(queueNumber) {
  const existing = document.getElementById('skip-notif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'skip-notif';
  notif.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#FFF7ED;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#EA6C00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="5 4 15 12 5 20 5 4"/>
          <line x1="19" x2="19" y1="5" y2="19"/>
        </svg>
      </div>
      <div>
        <p style="font-size:13px;font-weight:600;color:#111827;margin:0;">No Show</p>
        <p style="font-size:12px;color:#6B7280;margin:0;">${queueNumber} marked as no show</p>
      </div>
    </div>
  `;
  notif.style.cssText = `
    position:fixed;
    bottom:80px;
    right:20px;
    background:white;
    border:1px solid #E5E7EB;
    border-left:3px solid #EA6C00;
    border-radius:8px;
    padding:12px 16px;
    z-index:9999;
    box-shadow:0 4px 12px rgba(0,0,0,0.08);
    animation:slideInNotif 0.2s ease;
  `;

  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ============================================================
// PAUSE COUNTER BUTTON
// ============================================================
const pauseBtn = document.querySelector('#counter-subbar button:last-child');

if (pauseBtn) {
  let isPaused = false;
  pauseBtn.addEventListener('click', async () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    try {
      await fetch('/api/queue/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: isPaused ? 'pause' : 'resume' }),
      });
    } catch (err) {
      console.error('Pause/Resume failed:', err);
      isPaused = !isPaused;
      pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
    }
  });
}

// ============================================================
// CLOSE/OPEN COUNTER BUTTON (with backend persistence)
// ============================================================
const closeCounterBtn = document.querySelector('#counter-subbar button:first-of-type');
const openStatusDot = document.querySelector('#counter-subbar .bg-green-500');
const openStatusLabel = document.querySelector('#counter-subbar .text-green-600');

function updateCounterUI(status) {
  const closeCounterBtn = document.querySelector('#counter-subbar button:first-of-type');
  const openStatusDot = document.querySelector('#counter-subbar .bg-green-500');
  const openStatusLabel = document.querySelector('#counter-subbar .text-green-600');
  
  if (status === 'closed') {
    if (openStatusDot) {
      openStatusDot.classList.remove('bg-green-500');
      openStatusDot.classList.add('bg-gray-400');
    }
    if (openStatusLabel) {
      openStatusLabel.textContent = 'CLOSED';
      openStatusLabel.classList.remove('text-green-600');
      openStatusLabel.classList.add('text-gray-500');
    }
    if (closeCounterBtn) {
      closeCounterBtn.textContent = 'Open Counter';
    }
    isCounterClosed = true;
  } else {
    if (openStatusDot) {
      openStatusDot.classList.remove('bg-gray-400');
      openStatusDot.classList.add('bg-green-500');
    }
    if (openStatusLabel) {
      openStatusLabel.textContent = 'OPEN';
      openStatusLabel.classList.remove('text-gray-500');
      openStatusLabel.classList.add('text-green-600');
    }
    if (closeCounterBtn) {
      closeCounterBtn.textContent = 'Close Counter';
    }
    isCounterClosed = false;
  }
  
  console.log(`Counter status updated to: ${status}`);
}

async function loadCounterStatus() {
  if (!myStaffCounter) {
    await getMyStaffInfo();
  }
  
  if (!myStaffCounter) {
    console.log('No staff counter yet, skipping loadCounterStatus');
    return;
  }
  
  try {
    const res = await fetch(`/api/queue/counter-status?counter=${myStaffCounter}`);
    const data = await res.json();
    if (data.success) {
      updateCounterUI(data.status);
    }
  } catch (err) {
    console.error('Failed to load counter status:', err);
  }
}

if (closeCounterBtn) {
  const newCloseBtn = closeCounterBtn.cloneNode(true);
  closeCounterBtn.parentNode.replaceChild(newCloseBtn, closeCounterBtn);
  
  newCloseBtn.addEventListener('click', async () => {
    const newStatus = isCounterClosed ? 'open' : 'closed';
    const actionText = newStatus === 'closed' ? 'close' : 'open';
    const confirmed = window.confirm(`${actionText.toUpperCase()} the counter? ${newStatus === 'closed' ? 'No new patients will be routed here.' : 'Ready to receive patients.'}`);
    if (!confirmed) return;
    
    try {
      const res = await fetch('/api/queue/counter-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          counter: myStaffCounter,
          status: newStatus
        })
      });
      
      const data = await res.json();
      if (data.success) {
        updateCounterUI(data.status);
        const message = data.status === 'closed' ? 'Counter closed. No new patients will be assigned.' : 'Counter opened. Ready to receive patients.';
        showToast(message);
      }
    } catch (err) {
      console.error('Failed to toggle counter status:', err);
      alert('Failed to update counter status. Please try again.');
    }
  });
}

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(message) {
  const existingToast = document.querySelector('#toast-notification');
  if (existingToast) existingToast.remove();
  
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: #333;
    color: white;
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 9999;
    animation: fadeInOut 3s ease;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(20px); }
      15% { opacity: 1; transform: translateY(0); }
      85% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(20px); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showCompleteNotif(queueNumber) {
  const existing = document.getElementById('complete-notif');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'complete-notif';
  notif.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:32px;height:32px;border-radius:50%;background:#DCFCE7;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
      <div>
        <p style="font-size:13px;font-weight:600;color:#111827;margin:0;">Completed</p>
        <p style="font-size:12px;color:#6B7280;margin:0;">${queueNumber} marked as complete</p>
      </div>
    </div>
  `;
  notif.style.cssText = `
    position:fixed;
    bottom:80px;
    right:20px;
    background:white;
    border:1px solid #E5E7EB;
    border-left:3px solid #16A34A;
    border-radius:8px;
    padding:12px 16px;
    z-index:9999;
    box-shadow:0 4px_12px rgba(0,0,0,0.08);
    animation:slideInNotif 0.2s ease;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInNotif {
      from { opacity:0; transform:translateY(12px); }
      to   { opacity:1; transform:translateY(0); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ============================================================
// MANUAL ENTRY
// ============================================================
const manualInput = document.querySelector('#current-patient-panel input[type="text"]');
const manualSearch = document.querySelector('#current-patient-panel button.bg-\\[\\#0066FF\\]');

if (manualSearch && manualInput) {
  manualSearch.addEventListener('click', () => searchByQueueNumber(manualInput.value.trim()));
  manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchByQueueNumber(manualInput.value.trim());
  });
}

async function searchByQueueNumber(value) {
  if (!value) return;
  try {
    const res = await fetch(`/api/queue/status?queue=${value}`);
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Queue number not found.'); return; }
    showVerifiedPatient(data);
  } catch (err) {
    console.error('Manual entry search failed:', err);
    alert('Queue number not found.');
  }
}

function showVerifiedPatient(data) {
  const queueDisplay = document.querySelector('#current-patient-panel p.font-mono.text-\\[32px\\]');
  if (queueDisplay) queueDisplay.textContent = data.queue_number;

  const dds = document.querySelectorAll('#current-patient-panel dl dd');
  if (dds[0]) dds[0].textContent = data.patient_name || '—';
  if (dds[2]) dds[2].textContent = data.department || '—';
}

// ============================================================
// MANUAL ENTRY MODAL
// ============================================================
function openManualEntryModal() {
  const overlay = document.createElement('div');
  overlay.id = 'manual-entry-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;`;

  overlay.innerHTML = `
    <div style="background:white;border-radius:12px;padding:24px;width:100%;max-width:360px;margin:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:15px;font-weight:600;color:#111827;margin:0;">Manual Entry</h2>
        <button id="close-manual-modal" type="button"
          style="background:none;border:none;font-size:20px;color:#6B7280;cursor:pointer;"
          aria-label="Close">✕</button>
      </div>
      <p style="font-size:13px;color:#6B7280;margin:0 0 12px;">Enter the patient's queue number to verify.</p>
      <input
        id="manual-entry-input"
        type="text"
        placeholder="e.g. Q001"
        style="width:100%;height:36px;padding:0 12px;border:1px solid #E5E7EB;border-radius:7px;
          font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:12px;"
        autofocus>
      <div style="display:flex;gap:8px;">
        <button id="manual-entry-search-btn" type="button"
          style="flex:1;height:36px;background:#0066FF;color:white;border:none;
            border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">
          Search
        </button>
        <button id="manual-entry-cancel-btn" type="button"
          style="flex:1;height:36px;background:white;color:#374151;border:1px solid #E5E7EB;
            border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">
          Cancel
        </button>
      </div>
      <div id="manual-entry-result" style="display:none;margin-top:12px;padding:12px;
        background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;">
        <p style="font-size:13px;font-weight:600;color:#15803D;margin:0 0 8px;">Found</p>
        <dl id="manual-entry-details" style="font-size:13px;color:#374151;margin:0;"></dl>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById('manual-entry-input');
  const searchBtn = document.getElementById('manual-entry-search-btn');
  const cancelBtn = document.getElementById('manual-entry-cancel-btn');
  const closeBtn = document.getElementById('close-manual-modal');

  const closeModal = () => {
    const el = document.getElementById('manual-entry-overlay');
    if (el) el.remove();
  };

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  const doSearch = async () => {
    const value = input.value.trim().toUpperCase();
    if (!value) return;

    searchBtn.textContent = 'Searching...';
    searchBtn.disabled = true;

    try {
      const res = await fetch(`/api/queue/status?queue=${value}`);
      const data = await res.json();

      if (!res.ok) {
        input.style.borderColor = '#EF4444';
        searchBtn.textContent = 'Search';
        searchBtn.disabled = false;
        return;
      }

      input.style.borderColor = '#E5E7EB';
      const resultBox = document.getElementById('manual-entry-result');
      const details = document.getElementById('manual-entry-details');

      details.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:4px;">
          <dt style="color:#6B7280;width:90px;flex-shrink:0;">Queue No.</dt>
          <dd style="margin:0;font-weight:500;">${data.queue_number}</dd>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:4px;">
          <dt style="color:#6B7280;width:90px;flex-shrink:0;">Name</dt>
          <dd style="margin:0;font-weight:500;">${data.patient_name}</dd>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:4px;">
          <dt style="color:#6B7280;width:90px;flex-shrink:0;">Department</dt>
          <dd style="margin:0;font-weight:500;">${data.department}</dd>
        </div>
        <div style="display:flex;gap:8px;">
          <dt style="color:#6B7280;width:90px;flex-shrink:0;">Status</dt>
          <dd style="margin:0;font-weight:500;">${data.status}</dd>
        </div>`;

      resultBox.style.display = 'block';
      searchBtn.textContent = 'Search';
      searchBtn.disabled = false;

    } catch (err) {
      console.error('Manual search failed:', err);
      searchBtn.textContent = 'Search';
      searchBtn.disabled = false;
    }
  };

  searchBtn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  input.focus();
}

// ============================================================
// QR SCAN
// ============================================================
const scanQrBtn = document.querySelector('#now-serving-panel .flex.gap-2.flex-wrap ~ div button:first-child');
const manualEntryBtn = document.querySelector('#now-serving-panel .flex.gap-2.flex-wrap ~ div button:last-child');
const scanQrArea = document.querySelector('button[aria-label="Scan patient QR code"]');

if (manualEntryBtn) {
  manualEntryBtn.addEventListener('click', () => openManualEntryModal());
}

[scanQrBtn, scanQrArea].forEach(el => {
  if (el) el.addEventListener('click', openScanModal);
});

function openScanModal() {
  const overlay = document.createElement('div');
  overlay.id = 'qr-scan-overlay';
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;`;
  overlay.innerHTML = `
    <div style="background:white;border-radius:12px;padding:24px;width:100%;max-width:400px;margin:1rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:15px;font-weight:600;color:#111827;margin:0;">Scan Patient QR</h2>
        <button id="close-scan-modal" type="button" style="background:none;border:none;font-size:20px;color:#6B7280;cursor:pointer;" aria-label="Close scanner">✕</button>
      </div>
      <div id="qr-reader" style="width:100%;border-radius:8px;overflow:hidden;"></div>
      <div id="scan-result" style="display:none;margin-top:16px;padding:12px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;">
        <p style="font-size:13px;font-weight:600;color:#15803D;margin:0 0 8px;">Verified</p>
        <dl id="scan-result-details" style="font-size:13px;color:#374151;margin:0;"></dl>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button id="confirm-serve-btn" type="button" style="flex:1;height:36px;background:#0066FF;color:white;border:none;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">Confirm &amp; Serve</button>
          <button id="cancel-scan-btn" type="button" style="flex:1;height:36px;background:white;color:#374151;border:1px solid #E5E7EB;border-radius:7px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;">Cancel</button>
        </div>
      </div>
      <p style="font-size:12px;color:#9CA3AF;text-align:center;margin-top:12px;">Point camera at the patient's QR code</p>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeScanModal(); });
  document.getElementById('close-scan-modal').addEventListener('click', closeScanModal);
  startScanner();
}

let html5QrScanner = null;

function startScanner() {
  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('qr-reader').innerHTML = '<p style="text-align:center;font-size:13px;color:#9CA3AF;padding:2rem 0;">QR scanner unavailable.</p>';
    return;
  }
  html5QrScanner = new Html5Qrcode('qr-reader');
  html5QrScanner.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    decodedText => { html5QrScanner.stop().catch(() => { }); handleScannedQR(decodedText); },
    () => { }
  ).catch(err => {
    console.error('Camera start failed:', err);
    document.getElementById('qr-reader').innerHTML = '<p style="text-align:center;font-size:13px;color:#EF4444;padding:2rem 0;">Camera access denied.</p>';
  });
}

async function handleScannedQR(queueNumber) {
  try {
    const res = await fetch(`/api/queue/status?queue=${queueNumber}`);
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Could not verify this QR code.'); return; }
    showScanResult(data);
  } catch (err) {
    alert('Could not verify this QR code. Please try manual entry.');
  }
}

function showScanResult(data) {
  const resultBox = document.getElementById('scan-result');
  const details = document.getElementById('scan-result-details');
  if (!resultBox || !details) return;

  details.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:4px;"><dt style="color:#6B7280;width:90px;flex-shrink:0;">Queue No.</dt><dd style="margin:0;font-weight:500;">${data.queue_number}</dd></div>
    <div style="display:flex;gap:8px;margin-bottom:4px;"><dt style="color:#6B7280;width:90px;flex-shrink:0;">Name</dt><dd style="margin:0;font-weight:500;">${data.patient_name}</dd></div>
    <div style="display:flex;gap:8px;margin-bottom:4px;"><dt style="color:#6B7280;width:90px;flex-shrink:0;">Department</dt><dd style="margin:0;font-weight:500;">${data.department}</dd></div>
    <div style="display:flex;gap:8px;"><dt style="color:#6B7280;width:90px;flex-shrink:0;">Status</dt><dd style="margin:0;font-weight:500;">${data.status}</dd></div>`;

  resultBox.style.display = 'block';

  document.getElementById('confirm-serve-btn').onclick = async () => {
    await fetch('/api/queue/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'complete', queue_number: data.queue_number }),
    });
    closeScanModal();
  };
  document.getElementById('cancel-scan-btn').onclick = closeScanModal;
}

function closeScanModal() {
  if (html5QrScanner) {
    try {
      html5QrScanner.stop().catch(() => { }).finally(() => {
        html5QrScanner = null;
      });
    } catch (_) {
      html5QrScanner = null;
    }
  }
  const overlay = document.getElementById('qr-scan-overlay');
  if (overlay) overlay.remove();
}

// ============================================================
// SOCKET.IO
// ============================================================
const socket = io();

socket.on('queue:new', () => loadDashboard());
socket.on('queue:update', () => loadDashboard());
socket.on('queue:done', () => loadDashboard());
socket.on('queue:skip', () => loadDashboard());

// ── Send "almost your turn" email (using confirmation template) ──
socket.on('send:email:almost', (data) => {
  console.log('[COUNTER] send:email:almost received:', data); // ← add this
  if (!data.email) return;
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_ALMOST_TURN_TMPL, {
    email:          data.email,
    patient_name:   data.patient_name,
    queue_number:   data.queue_number,
    department:     data.department,
    counter:        data.counter,
    patients_ahead: data.patients_ahead,
  }).catch(err => console.error('Almost email failed:', err.text, err.status));
});

// ── Send "your turn" email ──
socket.on('send:email:turn', (data) => {
  console.log('Turn email data received:', data); // 👈 see what's coming in
  if (!data.email) return;
  emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TURN_TMPL, {
    email: data.email,
    patient_name: data.patient_name,
    queue_number: data.queue_number,
    department: data.department,
    counter: data.counter,
  }).catch(err => console.error('Turn email failed - text:', err.text, 'status:', err.status));
});

// ============================================================
// UPDATE NOW SERVING DISPLAY
// ============================================================
function updateNowServing(queueNumber, patientName, department = '—', counter = '—', startTime = '') {
  let counterNumber = counter;
  if (counter && counter !== '—') {
    const match = String(counter).match(/\d+/);
    counterNumber = match ? match[0] : counter;
  }

  const headingEl = document.getElementById('now-serving-heading');
  if (headingEl) headingEl.textContent = queueNumber || '—';

  const nameEl = document.querySelector('#now-serving-panel p.text-\\[18px\\]');
  if (nameEl) nameEl.textContent = patientName || '—';

  const deptEl = document.querySelector('#now-serving-panel .text-\\[13px\\].text-gray-500');
  if (deptEl) {
    deptEl.textContent = department;
  }

  const timeEl = document.querySelector('#now-serving-panel time');
  const timeParent = document.querySelector('#now-serving-panel .font-mono.text-\\[12px\\]');
  if (timeEl && startTime && startTime !== '—') {
    timeEl.textContent = startTime;
    if (timeParent) timeParent.style.display = 'block';
  } else if (timeParent) {
    timeParent.style.display = 'none';
  }

  const rightQueueEl = document.querySelector('#current-patient-panel p.font-mono.text-\\[32px\\]');
  if (rightQueueEl) rightQueueEl.textContent = queueNumber || '—';
}

// ============================================================
// INITIALIZATION
// ============================================================
(async function init() {
  try {
    await getMyStaffInfo();
    await loadCounterStatus();
    await loadDashboard();
  } finally {
    const loader = document.getElementById('page-loader');
    if (loader) loader.hidden = true;
    const leftCol = document.getElementById('left-col');
    const rightCol = document.getElementById('right-col');
    if (leftCol) leftCol.hidden = false;
    if (rightCol) rightCol.hidden = false;
  }
})();