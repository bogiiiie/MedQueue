const express = require('express');
const router = express.Router();
const sheets = require('../sheets');

console.log('Queue route loaded');

// ── EmailJS config ──
const EMAILJS_SERVICE_ID  = 'service_pssc8fl';
const EMAILJS_PUBLIC_KEY  = 'VGT84EnFa0OcMMxcs'; // ← use the one with uppercase O (from counter.js)
const EMAILJS_ALMOST_TMPL = 'template_u0ytxfe';
const EMAILJS_TURN_TMPL   = 'template_ebi2swf';

// ── Helper: send email via EmailJS REST API (server-side, no client needed) ──
async function sendEmailJS(templateId, params) {
  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:      EMAILJS_SERVICE_ID,
        template_id:     templateId,
        user_id:         EMAILJS_PUBLIC_KEY,
        template_params: params,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[EmailJS] Failed (${res.status}):`, text);
    } else {
      console.log(`[EmailJS] Email sent via template ${templateId} to ${params.email}`);
    }
  } catch (err) {
    console.error('[EmailJS] Request error:', err);
  }
}

// ── Department to Counter mapping ──
function getCounterByDepartment(department) {
  const counterMap = {
    'General Medicine': '1',
    'Pediatrics':       '2',
    'Cardiology':       '3',
    'Orthopedics':      '4',
  };
  return counterMap[department] || '1';
}

// ── Generate queue number ──
router.post('/generate', async (req, res) => {
  try {
    const { department, fullname, mobile, email } = req.body;

    const queueNumber = await sheets.getNextQueueNumberForDepartment(department);

    const counterAssignment = {
      'General Medicine': '1',
      'Pediatrics':       '2',
      'Cardiology':       '3',
      'Orthopedics':      '4',
      'Emergency':        '1',
    };
    const assignedCounter = counterAssignment[department] || '1';

    // Get position BEFORE adding the new entry
    const allQueues = await sheets.getAllQueues();
    const deptWaitingQueues = allQueues.filter(
      q => q.department === department && q.status === 'Waiting'
    );
    const position = deptWaitingQueues.length + 1;

    const nextId = allQueues.length + 1;

    await sheets.addQueueEntry({
      id:               nextId,
      queue_number:     queueNumber,
      patient_name:     fullname,
      mobile:           mobile,
      email,
      department,
      assigned_counter: assignedCounter,
      status:           'Waiting',
      created_at:       new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    });

    const estimatedWait = `${position * 8} min`;

    // ── Send "almost your turn" email if this patient is first in line ──
    // Done server-side so it fires regardless of whether any counter tab is open
    if (position === 1 && email) {
      sendEmailJS(EMAILJS_ALMOST_TMPL, {
        email,
        patient_name:   fullname,
        queue_number:   queueNumber,
        department,
        counter:        assignedCounter,
        patients_ahead: 0,
      });
    }

    res.json({
      success:       true,
      id:            queueNumber,
      queueNumber,
      department,
      counter:       assignedCounter,
      fullname,
      mobile,
      position,
      estimatedWait,
      generatedDate: new Date().toLocaleDateString('en-PH'),
      generatedAt:   new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }),
    });

  } catch (error) {
    console.error('Queue generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── Get queue list ──
router.get('/list', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { dept, counter } = req.query;
    let queues = await sheets.getAllQueues(dept || null);

    if (counter) {
      queues = queues.filter(q => q.assigned_counter == counter);
    }

    res.json({ success: true, queues });
  } catch (err) {
    console.error('Queue list error:', err);
    res.status(500).json({ error: 'Failed to fetch queue list.' });
  }
});

// ── Get single queue status ──
router.get('/status', async (req, res) => {
  try {
    const { queue } = req.query;
    if (!queue) return res.status(400).json({ error: 'queue param is required.' });

    const entry = await sheets.getQueueByNumber(queue);
    if (!entry) return res.status(404).json({ error: 'Queue number not found.' });

    const sameCounterQueues = await sheets.getAllQueues();
    const myCounterQueues   = sameCounterQueues.filter(q => q.assigned_counter === entry.assigned_counter);

    const waiting    = myCounterQueues.filter(q => q.status === 'Waiting');
    const serving    = myCounterQueues.find(q => q.status === 'Serving');
    const position   = waiting.findIndex(q => q.queue_number === queue) + 1;
    const nowServing = serving ? serving.queue_number : null;
    const avgMinsEach   = 8;
    const estimatedWait = position > 0 ? `~${position * avgMinsEach} min` : 'Your turn!';

    const myIndex = myCounterQueues.findIndex(q => q.queue_number === queue);
    const nearby  = myCounterQueues
      .slice(Math.max(0, myIndex - 2), myIndex + 3)
      .map(q => ({
        queue_number: q.queue_number,
        status:       q.status,
        isYou:        q.queue_number === queue,
      }));

    res.json({
      success:          true,
      queue_number:     entry.queue_number,
      patient_name:     entry.patient_name,
      mobile:           entry.mobile_number,
      email:            entry.email,
      department:       entry.department,
      assigned_counter: entry.assigned_counter,
      counter:          entry.counter,
      status:           entry.status,
      position:         position || 0,
      now_serving:      nowServing,
      estimated_wait:   estimatedWait,
      nearby,
    });

  } catch (err) {
    console.error('Queue status error:', err);
    res.status(500).json({ error: 'Failed to fetch queue status.' });
  }
});

// ── Update queue status ──
router.patch('/update', async (req, res) => {
  try {
    const { action, queue_number, staff_counter } = req.body;

    if (action === 'call_next') {
      const allQueues = await sheets.getAllQueues();

      const myCounterQueues = allQueues.filter(q => q.assigned_counter == staff_counter);
      const sortedQueues    = myCounterQueues.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      );

      const serving = sortedQueues.find(q => q.status === 'Serving');
      const waiting = sortedQueues.filter(q => q.status === 'Waiting');

      if (serving) {
        await sheets.updateQueueStatus(serving.queue_number, { status: 'Completed' });
      }

      if (waiting.length > 0) {
        const next = waiting[0];
        await sheets.updateQueueStatus(next.queue_number, { status: 'Serving' });

        // Send "your turn" email server-side
        if (next.email) {
          sendEmailJS(EMAILJS_TURN_TMPL, {
            email:        next.email,
            patient_name: next.patient_name,
            queue_number: next.queue_number,
            department:   next.department,
            counter:      next.counter,
          });
        }

        // Send "almost your turn" to the patient now 2nd in line
        if (waiting.length > 1) {
          const almostNext = waiting[1];
          if (almostNext.email) {
            sendEmailJS(EMAILJS_ALMOST_TMPL, {
              email:          almostNext.email,
              patient_name:   almostNext.patient_name,
              queue_number:   almostNext.queue_number,
              department:     almostNext.department,
              counter:        almostNext.counter,
              patients_ahead: 1,
            });
          }
        }

        req.io.emit('queue:update', {
          nowServing:  next.queue_number,
          patientName: next.patient_name,
          department:  next.department,
          counter:     staff_counter,
        });

        return res.json({ success: true, action: 'call_next', queue_number: next.queue_number });
      }

      return res.status(404).json({ error: 'No waiting patients for your counter' });
    }

    if (action === 'complete' && queue_number) {
      await sheets.updateQueueStatus(queue_number, { status: 'Completed' });
      req.io.emit('queue:done', { queueNumber: queue_number });
      return res.json({ success: true, action: 'complete', queue_number });
    }

    if (action === 'skip' && queue_number) {
      await sheets.updateQueueStatus(queue_number, { status: 'Skipped' });
      req.io.emit('queue:skip', { queueNumber: queue_number });
      return res.json({ success: true, action: 'skip', queue_number });
    }

    if (action === 'pause') {
      req.io.emit('queue:pause');
      return res.json({ success: true, action: 'pause' });
    }

    if (action === 'resume') {
      req.io.emit('queue:resume');
      return res.json({ success: true, action: 'resume' });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error('Queue update error:', err);
    res.status(500).json({ error: 'Failed to update queue.' });
  }
});

// ── Get counter status (open/closed) ──
router.get('/counter-status', async (req, res) => {
  try {
    const { counter } = req.query;

    if (!counter) {
      const allStatuses = await sheets.getAllCounterStatuses();
      return res.json({ success: true, counters: allStatuses });
    }

    const status = await sheets.getCounterStatus(counter);
    res.json({ success: true, counter, status });
  } catch (err) {
    console.error('Get counter status error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Update counter status (open/close) ──
router.post('/counter-status', async (req, res) => {
  try {
    const { counter, status } = req.body;

    if (!counter || !status) {
      return res.status(400).json({ error: 'counter and status are required' });
    }

    if (status !== 'open' && status !== 'closed') {
      return res.status(400).json({ error: 'status must be "open" or "closed"' });
    }

    await sheets.updateCounterStatus(counter, status);

    if (req.io) {
      req.io.emit('counter:status:change', { counter, status });
    }

    res.json({ success: true, counter, status });
  } catch (err) {
    console.error('Update counter status error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;