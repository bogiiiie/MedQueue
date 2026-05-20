// ── display.js — Live Queue Display ──
// Handles: department tab switching, countdown timer, Socket.io live updates

// ── Department tab switching ──
const tabButtons = document.querySelectorAll('[role="tab"]');

tabButtons.forEach((tab) => {
  tab.addEventListener('click', () => {
    // Update active tab styling
    tabButtons.forEach((t) => {
      t.classList.remove('border-b-[#0066FF]', 'text-[#0066FF]');
      t.classList.add('border-b-transparent', 'text-gray-500');
      t.setAttribute('aria-selected', 'false');
    });

    tab.classList.add('border-b-[#0066FF]', 'text-[#0066FF]');
    tab.classList.remove('border-b-transparent', 'text-gray-500');
    tab.setAttribute('aria-selected', 'true');

    const selectedDept = tab.textContent.trim();
    filterQueueCards(selectedDept);
  });
});

function filterQueueCards(dept) {
  const cards = document.querySelectorAll('#queue-grid article');

  cards.forEach((card) => {
    // Find the department paragraph (text-xs text-gray-400)
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
    
    resetCountdown();
    
  } catch (err) {
    console.error('Refresh failed:', err);
    resetCountdown();
  }
}

function updateFooterStats(queues) {
  const totalToday = queues.length;
  const waitingQueues = queues.filter(q => q.status === 'Waiting');
  const avgWaitMinutes = waitingQueues.length * 8; // 8 min per waiting patient
  
  const totalSpan = document.querySelector('#site-footer span:first-child strong');
  const avgSpan = document.querySelector('#site-footer span:nth-child(2) strong');
  
  if (totalSpan) totalSpan.textContent = totalToday;
  if (avgSpan) avgSpan.textContent = `${avgWaitMinutes} min`;
}

function updateNowServing(queueNumber) {
  const heroEl = document.querySelector('#now-serving-hero p[aria-live]');
  if (heroEl) heroEl.textContent = queueNumber;
  
  // Also update the counter/department text if needed
  const detailsEl = document.querySelector('#now-serving-hero p.text-gray-500');
  if (detailsEl && queueNumber !== '—') {
    // We don't have counter/dept here, will be set in renderCards
    // Keep existing or clear
    if (queueNumber === '—') detailsEl.textContent = 'No active queue';
  }
}

function updateNextUp(queueNumber) {
  const nextEl = document.querySelector('#next-up-bar span[aria-live]');
  if (nextEl) nextEl.textContent = queueNumber;
  
  // Update estimated wait
  const estWaitEl = document.querySelector('#next-up-bar span.text-\\[rgb\\(234\\,108\\,0\\)\\]');
  if (estWaitEl && queueNumber !== '—') {
    // Will be updated properly in renderCards
  }
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

  // Show last 20 queues or all
  const displayQueues = queues.slice(-20);
  
  // Find now serving for counter/department details
  const nowServing = queues.find(q => q.status === 'Serving');
  
  // Update now serving details with counter and department
  if (nowServing) {
    const detailsEl = document.querySelector('#now-serving-hero p.text-gray-500');
    if (detailsEl) {
      const counter = nowServing.counter || 'Counter —';
      const dept = nowServing.department || '—';
      detailsEl.textContent = `${counter} · ${dept}`;
    }
    
    // Update estimated wait for next up
    const waitingQueues = queues.filter(q => q.status === 'Waiting');
    const estWaitEl = document.querySelector('#next-up-bar span.text-\\[rgb\\(234\\,108\\,0\\)\\]');
    if (estWaitEl && waitingQueues.length > 0) {
      estWaitEl.textContent = `Est. ${waitingQueues.length * 8} min`;
    } else if (estWaitEl) {
      estWaitEl.textContent = 'No waiting patients';
    }
  }

  grid.innerHTML = displayQueues.map((q) => {
    const isServing   = q.status === 'Serving';
    const isCompleted = q.status === 'Completed';
    const isSkipped   = q.status === 'Skipped';
    const isDone      = isCompleted || isSkipped;

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

  // Re-apply active tab filter
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

function markCardCompleted(queueNumber) {
  // Optional: animate or update specific card without full refresh
  refreshQueueData();
}

function markCardSkipped(queueNumber) {
  refreshQueueData();
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

socket.on('queue:update', (data) => {
  refreshQueueData();
});

socket.on('queue:done', (data) => {
  refreshQueueData();
});

socket.on('queue:skip', (data) => {
  refreshQueueData();
});

socket.on('queue:pause', () => {
  showPauseBanner();
});

// ── Initial load ──
refreshQueueData();
startCountdown();