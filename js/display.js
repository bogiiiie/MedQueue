// ── display.js — Live Queue Display ──
// Handles: department tab switching, countdown timer, Socket.io live updates

// ── Department tab switching ──
const tabButtons = document.querySelectorAll('[role="tab"]');

tabButtons.forEach((tab) => {
  tab.addEventListener('click', async () => {
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
    
    // Update Now Serving section based on selected department
    await updateNowServingByDepartment(selectedDept);
  });
});

// ── Update Now Serving hero based on selected department ──
async function updateNowServingByDepartment(department) {
  try {
    const res = await fetch('/api/queue/list');
    const result = await res.json();
    
    if (!result.success) return;
    
    const allQueues = result.queues || [];
    
    // Get counter statuses
    const counterRes = await fetch('/api/queue/counter-status');
    const counterData = await counterRes.json();
    const counterStatuses = counterData.success ? counterData.counters : [];
    
    let nowServing;
    let assignedCounter = null;
    let departmentName = department;
    
    if (department === 'All') {
      // Show overall now serving (any department)
      nowServing = allQueues.find(q => q.status === 'Serving');
      if (nowServing) {
        assignedCounter = nowServing.assigned_counter;
        departmentName = nowServing.department;
      }
    } else {
      // Show now serving only for selected department
      nowServing = allQueues.find(q => q.status === 'Serving' && q.department === department);
      if (nowServing) {
        assignedCounter = nowServing.assigned_counter;
        departmentName = department;
      } else {
        // No active queue for this department, get counter for this department
        departmentName = department;
        assignedCounter = getCounterForDepartment(department);
      }
    }
    
    // Update the hero section
    const heroQueueEl = document.querySelector('#now-serving-hero .font-mono.font-bold');
    const heroDeptEl = document.querySelector('#now-serving-hero p.text-gray-500');
    
    // Update queue number
    if (heroQueueEl) {
      heroQueueEl.textContent = nowServing ? nowServing.queue_number : '—';
    }
    
    // Update department and counter info with status
    if (heroDeptEl && assignedCounter) {
      const counterStatus = counterStatuses.find(c => String(c.counter_number) === String(assignedCounter));
      const isClosed = counterStatus && counterStatus.status === 'closed';
      
      if (isClosed) {
        heroDeptEl.innerHTML = `Counter ${assignedCounter} &nbsp;·&nbsp; ${departmentName} <span class="ml-2 text-xs text-red-500 font-semibold">(CLOSED)</span>`;
      } else {
        heroDeptEl.innerHTML = `Counter ${assignedCounter} &nbsp;·&nbsp; ${departmentName}`;
      }
    } else if (heroDeptEl) {
      heroDeptEl.innerHTML = 'Select a department';
    }
    
    // Update Next Up section
    let waitingQueues;
    if (department === 'All') {
      waitingQueues = allQueues.filter(q => q.status === 'Waiting');
    } else {
      waitingQueues = allQueues.filter(q => q.status === 'Waiting' && q.department === department);
    }
    
    const nextUp = waitingQueues.length > 0 ? waitingQueues[0] : null;
    
    const nextUpEl = document.querySelector('#next-up-bar span.font-mono.text-\\[28px\\]');
    const estWaitEl = document.querySelector('#next-up-bar span.text-sm.text-\\[rgb\\(234\\,108\\,0\\)\\]');
    
    if (nextUpEl) {
      nextUpEl.textContent = nextUp ? nextUp.queue_number : '—';
    }
    
    if (estWaitEl && nextUp) {
      const position = waitingQueues.findIndex(q => q.queue_number === nextUp.queue_number) + 1;
      estWaitEl.textContent = `Est. ${position * 8} min`;
    } else if (estWaitEl) {
      estWaitEl.textContent = '—';
    }
    
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

// ── Load counter statuses for live display ──
async function loadCounterStatuses() {
  try {
    const res = await fetch('/api/queue/counter-status');
    const data = await res.json();
    
    if (data.success && data.counters) {
      const counterStatuses = data.counters;
      const nowServingDeptEl = document.querySelector('#now-serving-hero p.text-gray-500');
      
      if (nowServingDeptEl) {
        const currentText = nowServingDeptEl.textContent;
        const counterMatch = currentText.match(/Counter (\d+)/);
        
        if (counterMatch) {
          const counterNum = counterMatch[1];
          const counterStatus = counterStatuses.find(c => String(c.counter_number) === counterNum);
          
          if (counterStatus && counterStatus.status === 'closed') {
            // Check if CLOSED indicator already exists
            if (!currentText.includes('CLOSED')) {
              // Add red CLOSED text
              nowServingDeptEl.innerHTML = `${currentText} <span class="ml-2 text-xs text-red-500 font-semibold">CLOSED</span>`;
            }
          } else {
            // Remove CLOSED indicator if counter is open
            nowServingDeptEl.innerHTML = currentText.replace(/ <span class="ml-2 text-xs text-red-500 font-semibold">CLOSED<\/span>/, '');
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load counter statuses:', err);
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
    
    // Update now serving details with department and counter
    if (nowServing) {
      const detailsEl = document.querySelector('#now-serving-hero p.text-gray-500');
      if (detailsEl) {
        const counter = nowServing.counter || `Counter ${nowServing.assigned_counter || '?'}`;
        const dept = nowServing.department || '—';
        detailsEl.innerHTML = `${counter} &nbsp;·&nbsp; ${dept}`;
      }
    }
    
    // Load counter statuses to add CLOSED indicator if needed
    await loadCounterStatuses();
    
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
  const avgWaitMinutes = waitingQueues.length * 8;
  
  const totalSpan = document.querySelector('#site-footer span:first-child strong');
  const avgSpan = document.querySelector('#site-footer span:nth-child(2) strong');
  
  if (totalSpan) totalSpan.textContent = totalToday;
  if (avgSpan) avgSpan.textContent = `${avgWaitMinutes} min`;
}

function updateNowServing(queueNumber) {
  // This selects the big bold queue number
  const heroEl = document.querySelector('#now-serving-hero .font-mono.font-bold');
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
  
  const nowServing = queues.find(q => q.status === 'Serving');
  
  if (nowServing) {
    const waitingQueues = queues.filter(q => q.status === 'Waiting');
    const estWaitEl = document.querySelector('#next-up-bar span.text-sm.text-\\[rgb\\(234\\,108\\,0\\)\\]');
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