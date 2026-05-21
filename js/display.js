// ── display.js — Live Queue Display ──
// Handles: department tab switching, countdown timer, Socket.io live updates

// ── Department tab switching ──
const tabButtons = document.querySelectorAll('[role="tab"]');

tabButtons.forEach((tab) => {
  tab.addEventListener('click', async () => {
    tabButtons.forEach((t) => {
      t.classList.remove('border-b-[#0066FF]', 'text-[#0066FF]');
      t.classList.add('border-b-transparent', 'text-gray-500');
      t.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('border-b-[#0066FF]', 'text-[#0066FF]');
    tab.classList.remove('border-b-transparent', 'text-gray-500');
    tab.setAttribute('aria-selected', 'true');

    await updateNowServingByDepartment(tab.textContent.trim());
  });
});

// ── Standalone: stamp CLOSED onto the dept line if counter is closed ──
async function stampClosedIfNeeded() {
  const nowServingDeptEl = document.querySelector('#now-serving-hero p.text-gray-500');
  if (!nowServingDeptEl) return;

  // Always wipe any existing CLOSED span first
  nowServingDeptEl.innerHTML = nowServingDeptEl.innerHTML
    .replace(/<span[^>]*>CLOSED<\/span>/g, '')
    .trim();

  const counterMatch = nowServingDeptEl.textContent.match(/Counter (\d+)/);
  if (!counterMatch) return;

  try {
    const res = await fetch('/api/queue/counter-status');
    const data = await res.json();
    if (!data.success || !data.counters) return;

    const counterNum = counterMatch[1];
    const counterStatus = data.counters.find(c => String(c.counter_number) === counterNum);

    if (counterStatus && counterStatus.status === 'closed') {
      nowServingDeptEl.innerHTML += ` <span style="margin-left:6px; font-size:11px; font-weight:700; color:#DC2626; letter-spacing:0.05em;">CLOSED</span>`;
    }
  } catch (err) {
    console.error('Failed to check counter status:', err);
  }
}

// ── Update Now Serving hero based on selected department ──
async function updateNowServingByDepartment(department) {
  showLoader();
  try {
    const res = await fetch(`/api/queue/list?_=${Date.now()}`);
    const result = await res.json();
    if (!result.success) return;

    const allQueues = result.queues || [];

    const today = new Date().toDateString();

    // Filter to today's queues only
    const todayQueues = allQueues.filter(q =>
      new Date(q.created_at).toDateString() === today
    );

    // Pick the right subset based on selected tab
    const scopedQueues = department === 'All'
      ? todayQueues
      : todayQueues.filter(q => q.department === department);

    // Sort by created_at so oldest is first
    const sorted = [...scopedQueues].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );

    const nowServing = sorted.find(q => q.status === 'Serving');
    const waitingQueues = sorted.filter(q => q.status === 'Waiting');
    const nextUp = waitingQueues[0] || null;

    // Update now serving hero
    const heroQueueEl = document.getElementById('now-serving-number');
    if (heroQueueEl) {
      heroQueueEl.textContent = nowServing ? nowServing.queue_number : '—';
    }

    // Update counter + department line
    const heroDeptEl = document.querySelector('#now-serving-hero p.text-gray-500');
    if (heroDeptEl) {
      if (nowServing) {
        const counter = nowServing.counter || `Counter ${nowServing.assigned_counter || '?'}`;
        const dept = nowServing.department || '—';
        heroDeptEl.innerHTML = `${counter} &nbsp;·&nbsp; ${dept}`;
      } else {
        const counterNum = getCounterForDepartment(department === 'All' ? '' : department);
        heroDeptEl.innerHTML = department === 'All'
          ? 'No active serving'
          : `Counter ${counterNum} &nbsp;·&nbsp; ${department}`;
      }
    }

    // Always check and stamp CLOSED if needed after writing the dept line
    await stampClosedIfNeeded();

    // Update next up bar
    const nextUpEl = document.querySelector('#next-up-bar span.font-mono.text-\\[28px\\]');
    if (nextUpEl) nextUpEl.textContent = nextUp ? nextUp.queue_number : '—';

    const estWaitEl = document.querySelector('#next-up-bar span.text-sm.text-\\[rgb\\(234\\,108\\,0\\)\\]');
    if (estWaitEl) {
      if (nextUp) {
        estWaitEl.textContent = `Est. ${(waitingQueues.indexOf(nextUp) + 1) * 8} min`;
      } else {
        estWaitEl.textContent = 'No waiting patients';
      }
    }

    // Re-render cards filtered to this department
    renderCards(scopedQueues);
    hideLoader();

  } catch (err) {
    console.error('Failed to update now serving by department:', err);
  }
}

// Helper function to get counter for a department
function getCounterForDepartment(department) {
  const counterMap = {
    'General Medicine': '1',
    'Pediatrics': '2',
    'Cardiology': '3',
    'Orthopedics': '4',
    'Emergency': '1'
  };
  return counterMap[department] || '1';
}

// ── Filter queue cards by department ──
function filterQueueCards(dept) {
  const cards = document.querySelectorAll('#queue-grid article');

  cards.forEach((card) => {
    const deptEl = card.querySelector('p.text-xs.text-gray-400');
    if (!deptEl) {
      card.style.display = '';
      return;
    }

    const cardDept = deptEl.textContent.trim();

    if (dept === 'All' || cardDept === dept) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

// ── Auto-refresh countdown ──
const countdownEl = document.getElementById('refresh-countdown');
let secondsLeft = 30;
let countdownInterval;

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    secondsLeft--;
    if (countdownEl) {
      countdownEl.textContent = `Auto-refreshes in ${secondsLeft}s`;
    }

    if (secondsLeft <= 0) {
      secondsLeft = 30;
      refreshQueueData();
    }
  }, 1000);
}

function resetCountdown() {
  secondsLeft = 30;
  if (countdownEl) {
    countdownEl.textContent = `Auto-refreshes in ${secondsLeft}s`;
  }
}

// ── Fetch real queue data from backend ──
async function refreshQueueData() {
  showLoader();
  try {
    const res = await fetch('/api/queue/list');
    const result = await res.json();

    if (!result.success) {
      console.error('Failed to load queue data:', result.error);
      return;
    }

    const queues = result.queues || [];

    // Find now serving and next up
    const nowServing = queues.find(q => q.status === 'Serving');
    const waitingQueues = queues.filter(q => q.status === 'Waiting');
    const nextUp = waitingQueues.length > 0 ? waitingQueues[0] : null;

    // Update hero sections
    updateNowServing(nowServing ? nowServing.queue_number : '—');
    updateNextUp(nextUp ? nextUp.queue_number : '—');

    // Render cards
    renderCards(queues);

    // Update now serving details with department and counter
    if (nowServing) {
      const detailsEl = document.querySelector('#now-serving-hero p.text-gray-500');
      if (detailsEl) {
        const counter = nowServing.counter || `Counter ${nowServing.assigned_counter || '?'}`;
        const dept = nowServing.department || '—';
        detailsEl.innerHTML = `${counter} &nbsp;·&nbsp; ${dept}`;
      }
    }

    // Always check and stamp CLOSED if needed after writing the dept line
    await stampClosedIfNeeded();

    // Update footer timestamp
    const updatedEl = document.querySelector('#site-footer time');
    if (updatedEl) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      updatedEl.textContent = `Updated ${timeStr}`;
      updatedEl.setAttribute('datetime', now.toISOString());
    }

    // Update total and avg wait in footer
    updateFooterStats(queues);

    hideLoader();
    resetCountdown();

  } catch (err) {
    console.error('Refresh failed:', err);
    resetCountdown();
  }
}

function updateFooterStats(queues) {
  const totalToday = queues.length;
  const waitingQueues = queues.filter(q => q.status === 'Waiting');
  const avgWaitMinutes = waitingQueues.length * 8;

  const totalSpan = document.querySelector('#site-footer span:first-child strong');
  const avgSpan = document.querySelector('#site-footer span:nth-child(2) strong');

  if (totalSpan) totalSpan.textContent = totalToday;
  if (avgSpan) avgSpan.textContent = `${avgWaitMinutes} min`;
}

function updateNowServing(queueNumber) {
  const heroEl = document.getElementById('now-serving-number');
  if (heroEl) heroEl.textContent = queueNumber || '—';
}

function updateNextUp(queueNumber) {
  const nextEl = document.querySelector('#next-up-bar span.font-mono.text-\\[28px\\]');
  if (nextEl) nextEl.textContent = queueNumber || '—';
}

function renderCards(queues) {
  const grid = document.getElementById('queue-grid');
  if (!grid) return;

  if (queues.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-gray-400">
        No queue entries yet
      </div>
    `;
    return;
  }

  const displayQueues = queues.slice(-20);

  // Always update the est. wait regardless of whether someone is serving
  const waitingQueues = queues.filter(q => q.status === 'Waiting');
  const estWaitEl = document.querySelector('#next-up-bar span.text-sm.text-\\[rgb\\(234\\,108\\,0\\)\\]');
  if (estWaitEl) {
    estWaitEl.textContent = waitingQueues.length > 0
      ? `Est. ${waitingQueues.length * 8} min`
      : 'No waiting patients';
  }

  grid.innerHTML = displayQueues.map((q) => {
    const isServing = q.status === 'Serving';
    const isCompleted = q.status === 'Completed';
    const isSkipped = q.status === 'Skipped';
    const isDone = isCompleted || isSkipped;

    return `
      <article
        class="${isDone
        ? 'bg-gray-50'
        : isServing
          ? 'bg-[#EFF5FF] border-l-2 border-l-[#0066FF]'
          : 'bg-white'
      } rounded-[10px] border border-gray-200 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        aria-label="Queue ${q.queue_number} — ${q.status}"
        ${isServing ? 'aria-current="true"' : ''}
      >
        <div class="flex items-start justify-between mb-1">
          <span class="font-mono text-[20px] font-semibold ${isDone ? 'text-gray-400' : 'text-gray-900'}">
            ${q.queue_number}
          </span>
          ${statusBadge(q.status)}
        </div>
        <p class="text-sm ${isDone ? 'text-gray-400 line-through' : 'text-gray-600'} mb-0.5">
          ${escapeHtml(q.patient_name ? q.patient_name.split(' ')[0] : '—')}
        </p>
        <p class="text-xs text-gray-400">${q.department || '—'}</p>
        ${q.counter && !isDone ? `<p class="text-xs text-gray-400 mt-1">Counter: ${q.counter}</p>` : ''}
      </article>
    `;
  }).join('');

  const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
  if (activeTab) filterQueueCards(activeTab.textContent.trim());
}

function statusBadge(status) {
  switch (status) {
    case 'Serving':
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-[#EFF5FF] text-[#0052CC] border border-blue-200">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse" aria-hidden="true"></span>
        Now Serving
      </span>`;
    case 'Completed':
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-green-50 text-green-700 border border-green-200">Completed</span>`;
    case 'Skipped':
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-orange-50 text-orange-700 border border-orange-200">No Show</span>`;
    default:
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-gray-50 text-gray-500 border border-gray-200">Waiting</span>`;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showLoader() {
  document.getElementById('page-loader').hidden = false;
  document.getElementById('now-serving-hero').hidden = true;
  document.getElementById('next-up-bar').hidden = true;
  document.getElementById('main-content').hidden = true;
  document.getElementById('site-footer').hidden = true;
}

function hideLoader() {
  document.getElementById('page-loader').hidden = true;
  document.getElementById('now-serving-hero').hidden = false;
  document.getElementById('next-up-bar').hidden = false;
  document.getElementById('main-content').hidden = false;
  document.getElementById('site-footer').hidden = false;
}

function showPauseBanner() {
  const banner = document.createElement('div');
  banner.className = 'fixed top-0 left-0 right-0 bg-orange-500 text-white text-center py-2 z-50';
  banner.textContent = 'Queue system is temporarily paused. Staff will resume shortly.';
  document.body.prepend(banner);
  setTimeout(() => banner.remove(), 5000);
}

// ── Socket.io — Real-time updates ──
const socket = io();

socket.on('queue:update', () => {
  refreshQueueData();
});

socket.on('queue:done', () => {
  refreshQueueData();
});

socket.on('queue:skip', () => {
  refreshQueueData();
});

socket.on('queue:pause', () => {
  showPauseBanner();
});

// ── Initial load ──
refreshQueueData();
startCountdown();