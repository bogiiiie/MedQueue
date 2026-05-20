// ── Page Switcher ──
// This file is shared across all pages.
// Each page loads it via <script src="js/page-switcher.js"></script>

const pageSwitcherTrigger = document.getElementById('page-switcher-trigger');
const pageSwitcherMenu = document.getElementById('page-switcher-menu');

pageSwitcherTrigger.addEventListener('click', () => {
  const isOpen = !pageSwitcherMenu.hidden;
  pageSwitcherMenu.hidden = isOpen;
  pageSwitcherTrigger.setAttribute('aria-expanded', String(!isOpen));
});

// ── Close on outside click ──
document.addEventListener('click', (e) => {
  if (
    !pageSwitcherTrigger.contains(e.target) &&
    !pageSwitcherMenu.contains(e.target)
  ) {
    pageSwitcherMenu.hidden = true;
    pageSwitcherTrigger.setAttribute('aria-expanded', 'false');
  }
});

// ── Close on Escape ──
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  pageSwitcherMenu.hidden = true;
  pageSwitcherTrigger.setAttribute('aria-expanded', 'false');
});

// ── Nav button routing with smart queue-status navigation ──
function navigateTo(page, params = '') {
  window.location.href = params ? `${page}?${params}` : page;
}

const routes = {
  'nav-queue-generator-btn': () => navigateTo('index.html'),
  'nav-live-display-btn': () => navigateTo('live-display.html'),
  'nav-queue-status-btn': () => {
    const lastQueue = sessionStorage.getItem('lastQueueNumber');
    const lastDept = sessionStorage.getItem('lastDepartment');

    if (lastQueue) {
      // Navigate with stored queue number
      navigateTo('queue-status.html', `queue=${lastQueue}&dept=${encodeURIComponent(lastDept || '')}`);
    } else {
      // No queue found - show alert and stay on current page
      alert('No active queue found. Please register for a queue number first.');
      return;
    }
  },
  'nav-staff-login-switcher-btn': () => navigateTo('staff-login.html'),
  'nav-counter-dashboard-btn': () => {
    // Check if already authenticated via session
    fetch('/api/auth/check')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          navigateTo('counter-dashboard.html');
        } else {
          navigateTo('staff-login.html');
        }
      })
      .catch(() => navigateTo('staff-login.html'));
  },
};

Object.entries(routes).forEach(([id, navigateFn]) => {
  const btn = document.getElementById(id);
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigateFn();
    });
  }
});