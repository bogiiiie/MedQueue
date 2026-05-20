// ── Password show/hide toggle ──
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');
const passwordToggleIcon = document.getElementById('password-toggle-icon');

const eyeIcon = `<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>`;
const eyeOffIcon = `<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>`;

passwordToggle.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  passwordToggleIcon.innerHTML = isPassword ? eyeOffIcon : eyeIcon;
  passwordToggle.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

// ── Form validation + submit ──
const staffLoginForm = document.getElementById('staff-login-form');
const loginBtn = document.getElementById('login-btn');

staffLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let isValid = true;

  const usernameInput = document.getElementById('username');
  const usernameError = document.getElementById('username-error');
  const passwordError = document.getElementById('password-error');

  // Validate username
  if (!usernameInput.value.trim()) {
    usernameError.hidden = false;
    usernameInput.setAttribute('aria-invalid', 'true');
    isValid = false;
  } else {
    usernameError.hidden = true;
    usernameInput.removeAttribute('aria-invalid');
  }

  // Validate password
  if (!passwordInput.value.trim()) {
    passwordError.hidden = false;
    passwordInput.setAttribute('aria-invalid', 'true');
    isValid = false;
  } else {
    passwordError.hidden = true;
    passwordInput.removeAttribute('aria-invalid');
  }

  if (!isValid) return;

  // ── Show loading state ──
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    // TODO: Replace with real API call once backend is ready
    // const response = await fetch('/api/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     username: usernameInput.value.trim(),
    //     password: passwordInput.value,
    //   }),
    // });
    //
    // if (!response.ok) {
    //   const err = await response.json();
    //   throw new Error(err.message || 'Invalid credentials');
    // }
    //
    // window.location.href = 'counter-dashboard.html';

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: usernameInput.value.trim(),
        password: passwordInput.value,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Invalid username or password.');
    }

    window.location.href = 'counter-dashboard.html';

  } catch (err) {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';

    // Show a friendly error under the password field
    passwordError.textContent = err.message || 'Invalid username or password.';
    passwordError.hidden = false;
    passwordInput.setAttribute('aria-invalid', 'true');
  }
});