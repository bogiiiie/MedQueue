// ── Mobile nav toggle ──
const navMobileToggle = document.getElementById('nav-mobile-toggle');
const mobileMenu = document.getElementById('mobile-menu');

navMobileToggle.addEventListener('click', () => {
  const isOpen = !mobileMenu.hidden;
  mobileMenu.hidden = isOpen;
  navMobileToggle.setAttribute('aria-expanded', String(!isOpen));
  navMobileToggle.setAttribute('aria-label', isOpen ? 'Open navigation menu' : 'Close navigation menu');
});

// ── Desktop departments dropdown ──
const navDepartmentsBtn = document.getElementById('nav-departments-btn');
const navDepartmentsMenu = document.getElementById('nav-departments-menu');

navDepartmentsBtn.addEventListener('click', () => {
  const isOpen = !navDepartmentsMenu.hidden;
  navDepartmentsMenu.hidden = isOpen;
  navDepartmentsBtn.setAttribute('aria-expanded', String(!isOpen));
});

// ── Mobile departments dropdown ──
const mobileDepartmentsBtn = document.getElementById('mobile-departments-btn');
const mobileDepartmentsMenu = document.getElementById('mobile-departments-menu');

mobileDepartmentsBtn.addEventListener('click', () => {
  const isOpen = !mobileDepartmentsMenu.hidden;
  mobileDepartmentsMenu.hidden = isOpen;
  mobileDepartmentsBtn.setAttribute('aria-expanded', String(!isOpen));
});

// ── Close dropdowns on outside click ──
document.addEventListener('click', (e) => {
  if (
    navDepartmentsBtn &&
    !navDepartmentsBtn.contains(e.target) &&
    !navDepartmentsMenu.contains(e.target)
  ) {
    navDepartmentsMenu.hidden = true;
    navDepartmentsBtn.setAttribute('aria-expanded', 'false');
  }
});

// ── Close dropdowns on Escape ──
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  navDepartmentsMenu.hidden = true;
  navDepartmentsBtn.setAttribute('aria-expanded', 'false');
  mobileDepartmentsMenu.hidden = true;
  mobileDepartmentsBtn.setAttribute('aria-expanded', 'false');
});

// ── Staff Login button in nav → go to login page ──
const navStaffLoginBtn = document.getElementById('nav-staff-login-btn');
if (navStaffLoginBtn) {
  navStaffLoginBtn.addEventListener('click', () => {
    window.location.href = 'staff-login.html';
  });
}

// ── Department nav → auto-select in form ──
document.querySelectorAll('[data-department]').forEach(btn => {
  btn.addEventListener('click', () => {
    const value = btn.getAttribute('data-department');
    const departmentSelect = document.getElementById('department');
    if (departmentSelect) {
      departmentSelect.value = value;
      document.getElementById('department-error').hidden = true;
      departmentSelect.removeAttribute('aria-invalid');
      departmentSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // Close all dropdowns
    navDepartmentsMenu.hidden = true;
    navDepartmentsBtn.setAttribute('aria-expanded', 'false');
    mobileDepartmentsMenu.hidden = true;
    mobileDepartmentsBtn.setAttribute('aria-expanded', 'false');
    mobileMenu.hidden = true;
    navMobileToggle.setAttribute('aria-expanded', 'false');
  });
});

// ── Avg Wait card ── (store queues globally for filter)
let _allQueues = [];

let _avgWaitDept = 'all';

function updateAvgWait() {
  const waiting = _allQueues.filter(q =>
    q.status === 'Waiting' && (_avgWaitDept === 'all' || q.department === _avgWaitDept)
  );
  const avgWaitEl = document.getElementById('avg-wait-value');
  if (avgWaitEl) avgWaitEl.textContent = `${waiting.length * 8} min`;
}

// ── Avg wait dept dropdown ──
const avgWaitBtn = document.getElementById('avg-wait-dept-btn');
const avgWaitMenu = document.getElementById('avg-wait-dept-menu');

avgWaitBtn?.addEventListener('click', () => {
  const isOpen = !avgWaitMenu.hidden;
  avgWaitMenu.hidden = isOpen;
  avgWaitBtn.setAttribute('aria-expanded', String(!isOpen));
});

avgWaitMenu?.querySelectorAll('button[data-dept]').forEach(btn => {
  btn.addEventListener('click', () => {
    _avgWaitDept = btn.getAttribute('data-dept');
    document.getElementById('avg-wait-dept-label').textContent = btn.textContent.trim();
    avgWaitMenu.hidden = true;
    avgWaitBtn.setAttribute('aria-expanded', 'false');
    updateAvgWait();
  });
});

document.addEventListener('click', (e) => {
  if (avgWaitBtn && !avgWaitBtn.contains(e.target) && avgWaitMenu && !avgWaitMenu.contains(e.target)) {
    avgWaitMenu.hidden = true;
    avgWaitBtn?.setAttribute('aria-expanded', 'false');
  }
});

// ── Live Queue Stats + Table ──
async function loadIndexQueue() {
  try {
    const res = await fetch(`/api/queue/list?_=${Date.now()}`);
    const result = await res.json();
    if (!result.success) return;

    _allQueues = result.queues;
    const queues = result.queues;

    const serving = queues
      .filter(q => q.status === 'Serving')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

    const waiting = queues
      .filter(q => q.status === 'Waiting')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // ── Now Serving card ──
    const nowServingEl = document.querySelector('#now-serving-card p.font-mono');
    if (nowServingEl) nowServingEl.textContent = serving ? serving.queue_number : '—';

    // ── Next Up card ──
    const nextUpEl = document.querySelector('#next-in-queue-card p.font-mono');
    if (nextUpEl) nextUpEl.textContent = waiting.length > 0 ? waiting[0].queue_number : '—';

    // ── Avg Wait card ──
    updateAvgWait();

    // ── Last updated ──
    const lastUpdatedEl = document.getElementById('queue-last-updated');
    if (lastUpdatedEl) {
      const now = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      lastUpdatedEl.innerHTML = `<time>Last updated ${now}</time>`;
    }

    // ── Queue table ──
    const tbody = document.querySelector('#queue-table tbody');
    if (tbody) {
      if (queues.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;font-size:13px;color:#9CA3AF;">No queue entries yet.</td></tr>`;
      } else {
        tbody.innerHTML = queues.map(q => {
          const isServing = q.status === 'Serving';
          const isCompleted = q.status === 'Completed' || q.status === 'Skipped';

          let badge = '';
          if (isServing) {
            badge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-[5px] bg-[#EFF5FF] text-[#0052CC] border border-blue-200">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-[#0066FF] animate-pulse" aria-hidden="true"></span>
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
            <td class="py-2.5 pr-4 text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}">${q.department || '—'}</td>
            <td class="py-2.5 pr-4 text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-700'}">${q.counter || '—'}</td>
            <td class="py-2.5">${badge}</td>
          </tr>`;
        }).join('');
      }
    }

    // ── Hide loader, show content ──
    document.getElementById('page-loader').hidden = true;
    document.getElementById('queue-stats').hidden = false;
    document.getElementById('queue-status').hidden = false;
    document.getElementById('queue-form-panel').hidden = false;

  } catch (err) {
    console.error('Failed to load index queue:', err);
    document.getElementById('page-loader').hidden = true;
    document.getElementById('queue-stats').hidden = false;
    document.getElementById('queue-status').hidden = false;
    document.getElementById('queue-form-panel').hidden = false;
  }
}

// ── Dept filter change ──
document.getElementById('avg-wait-dept-filter')?.addEventListener('change', updateAvgWait);

// ── Refresh button ──
const queueRefreshBtn = document.getElementById('queue-refresh-btn');
if (queueRefreshBtn) {
  queueRefreshBtn.addEventListener('click', async () => {
    const icon = queueRefreshBtn.querySelector('svg');
    queueRefreshBtn.disabled = true;
    if (icon) icon.style.animation = 'spin 0.6s linear infinite';
    await loadIndexQueue();
    queueRefreshBtn.disabled = false;
    if (icon) icon.style.animation = '';
  });
}

// ── Socket.io live updates ──
if (typeof io !== 'undefined') {
  const socket = io();
  socket.on('queue:new', () => loadIndexQueue());
  socket.on('queue:update', () => loadIndexQueue());
  socket.on('queue:done', () => loadIndexQueue());
  socket.on('queue:skip', () => loadIndexQueue());
}

// ── Init ──
loadIndexQueue();