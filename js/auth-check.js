// ── Authentication check for protected pages ──

(async function checkAuth() {
  try {
    console.log('Checking authentication...');
    const res = await fetch('/api/auth/check', {
      credentials: 'include'
    });
    const data = await res.json();
    console.log('Auth check response:', data);
    
    if (!data.authenticated) {
      console.log('Not authenticated, redirecting to login');
      window.location.href = 'staff-login.html';
      return;
    }
    
    console.log('Authenticated as:', data.staff);
    
    // Helper function to extract just the number from counter value
    function getCounterNumber(counterValue) {
      if (!counterValue || counterValue === '—') return '—';
      const match = String(counterValue).match(/\d+/);
      return match ? match[0] : counterValue;
    }
    
    // Helper function to get initials from name
    function getInitials(name) {
      if (!name || name === '—') return 'NA';
      const nameParts = name.trim().split(' ');
      if (nameParts.length === 1) {
        return nameParts[0].charAt(0).toUpperCase();
      }
      return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
    }
    
    // Update staff info in header
    if (data.staff) {
      // Update the avatar initials
      const avatarEl = document.querySelector('#site-header .hidden.md\\:flex .w-7.h-7');
      if (avatarEl) {
        const initials = getInitials(data.staff.name);
        avatarEl.textContent = initials;
      }
      
      // Update the staff name
      const staffNameEl = document.querySelector('#site-header .hidden.md\\:flex .text-sm.text-gray-900');
      if (staffNameEl) {
        staffNameEl.textContent = data.staff.name || 'Staff';
      }
      
      // Update staff details - this shows "Counter X · Department"
      const staffDetailsEl = document.querySelector('#site-header .hidden.md\\:flex .text-\\[12px\\].text-gray-500');
      if (staffDetailsEl) {
        const counterNum = getCounterNumber(data.staff.counter);
        const deptName = data.staff.department || '—';
        staffDetailsEl.textContent = `Counter ${counterNum} · ${deptName}`;
      }
      
      // Update counter subbar - Counter number (first span)
      const counterNumberSpan = document.querySelector('#counter-subbar .flex.items-center.gap-2 .text-sm.font-semibold');
      if (counterNumberSpan) {
        const counterNum = getCounterNumber(data.staff.counter);
        counterNumberSpan.textContent = `Counter ${counterNum}`;
      }
      
      // Update counter subbar - Department (last span)
      const counterDeptSpan = document.querySelector('#counter-subbar .flex.items-center.gap-2 .text-sm.text-gray-500');
      if (counterDeptSpan) {
        counterDeptSpan.textContent = data.staff.department || '—';
      }
    }
    
    // Store staff info globally for use in counter.js
    window.currentStaff = data.staff;
    
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'staff-login.html';
  }
})();

// ── Logout handler ──
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  const newLogoutBtn = logoutBtn.cloneNode(true);
  logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
  
  newLogoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Logout failed:', err);
    }
    window.location.href = 'staff-login.html';
  });
}