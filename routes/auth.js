const express = require('express');
const router  = express.Router();
const sheets  = require('../sheets');
// Remove this line: const bcrypt = require('bcryptjs');

// ── Login ──
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const staff = await sheets.getStaffByUsername(username.trim());
    console.log('Staff found:', staff);

    if (!staff) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Plain text password comparison (no bcrypt)
    const passwordMatch = (password === staff.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Save staff info in session
    req.session.staff = {
      id:         staff.id,
      name:       staff.name,
      username:   staff.username,
      counter:    staff.counter,
      department: staff.department,
    };

    res.json({
      success:    true,
      name:       staff.name,
      counter:    staff.counter,
      department: staff.department,
    });

  } catch (err) {
    console.error('Login error FULL:', err.stack || err);
    res.status(500).json({ error: err.message || 'Login failed. Please try again.' });
  }
});

// ── Logout ──
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed.' });
    }
    res.json({ success: true });
  });
});

// ── Auth check middleware ──
function requireAuth(req, res, next) {
  if (req.session && req.session.staff) {
    return next();
  }
  res.status(401).json({ error: 'Not logged in. Please login first.' });
}

// ── Check if user is authenticated ──
router.get('/check', (req, res) => {
  if (req.session && req.session.staff) {
    res.json({
      authenticated: true,
      staff: req.session.staff
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;