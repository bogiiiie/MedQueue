const express = require('express');
const router  = express.Router();
const sheets  = require('../sheets');

console.log('Queue route loaded');

// ── Department to Counter mapping ──
function getCounterByDepartment(department) {
  const counterMap = {
    'General Medicine': '1',
    'Pediatrics': '2',
    'Cardiology': '3',
    'Orthopedics': '4'
  };
  return counterMap[department] || '1'; // Default to Counter 1
}

// ── Generate queue number ──
router.post('/generate', async (req, res) => {
  try {
    const { fullname, mobile, department, email } = req.body;

    if (!fullname || !mobile || !department || !email) {
      return res.status(400).json({ error: 'fullname, mobile, department, and email are required.' });
    }

    const existing    = await sheets.getAllQueues();
    const nextNumber  = existing.length + 1;
    const queueNumber = `Q${String(nextNumber).padStart(3, '0')}`;
    
    // Assign counter based on department
    const assignedCounter = getCounterByDepartment(department);
    const counter = `Counter ${assignedCounter}`;

    // Count waiting patients for THIS specific counter only
    const waitingAhead = existing.filter((q) => q.assigned_counter == assignedCounter && q.status === 'Waiting').length;
    const position = waitingAhead + 1;
    const avgMinsEach = 8;
    const minWait = position * avgMinsEach - 5;
    const maxWait = position * avgMinsEach + 5;
    const estimatedWait = `${Math.max(0, minWait)} - ${maxWait} minutes`;

    const now       = new Date();
    const createdAt = now.toISOString().replace('T', ' ').substring(0, 19);

    const entry = {
      id:               nextNumber,
      queue_number:     queueNumber,
      patient_name:     fullname,
      mobile_number:    mobile,
      email,
      department,
      assigned_counter: assignedCounter,  // NEW FIELD
      counter,
      status:           'Waiting',
      created_at:       createdAt,
    };

    await sheets.addQueueEntry(entry);
    req.io.emit('queue:new', { queue_number: queueNumber, department, counter });

    res.json({
      success: true, queueNumber, fullname, mobile, email, department, counter,
      assigned_counter: assignedCounter,
      position, estimatedWait, status: 'Waiting',
      generatedAt:   now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      generatedDate: now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    });

  } catch (err) {
    console.error('Generate queue error FULL:', err.stack || err);
    res.status(500).json({ error: err.message || 'Failed to generate queue number. Please try again.' });
  }
});

// ── Get queue list ──
router.get('/list', async (req, res) => {
  try {
    const { dept, counter } = req.query;
    let queues = await sheets.getAllQueues(dept || null);
    
    // Optional: filter by assigned counter
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
    if (!entry)  return res.status(404).json({ error: 'Queue number not found.' });

    // Get queues for the SAME assigned counter only
    const sameCounterQueues = await sheets.getAllQueues();
    const myCounterQueues = sameCounterQueues.filter(q => q.assigned_counter === entry.assigned_counter);
    
    const waiting = myCounterQueues.filter((q) => q.status === 'Waiting');
    const serving = myCounterQueues.find((q) => q.status === 'Serving');
    const position = waiting.findIndex((q) => q.queue_number === queue) + 1;
    const nowServing = serving ? serving.queue_number : null;
    const avgMinsEach = 8;
    const estimatedWait = position > 0 ? `~${position * avgMinsEach} min` : 'Your turn!';

    const myIndex = myCounterQueues.findIndex((q) => q.queue_number === queue);
    const nearby = myCounterQueues.slice(Math.max(0, myIndex - 2), myIndex + 3).map((q) => ({
      queue_number: q.queue_number,
      status: q.status,
      isYou: q.queue_number === queue,
    }));

    res.json({
      success: true,
      queue_number:   entry.queue_number,
      patient_name:   entry.patient_name,
      mobile:         entry.mobile_number,
      email:          entry.email,
      department:     entry.department,
      assigned_counter: entry.assigned_counter,
      counter:        entry.counter,
      status:         entry.status,
      position:       position || 0,
      now_serving:    nowServing,
      estimated_wait: estimatedWait,
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
      
      // Get queues for THIS specific counter only
      const myCounterQueues = allQueues.filter(q => q.assigned_counter == staff_counter);
      
      // Find serving patient for this counter
      const serving = myCounterQueues.find((q) => q.status === 'Serving');
      
      // Find waiting patients for this counter
      const waiting = myCounterQueues.filter((q) => q.status === 'Waiting');

      // Complete the current serving patient (if any)
      if (serving) {
        await sheets.updateQueueStatus(serving.queue_number, { status: 'Completed' });
      }

      // Call the next waiting patient
      if (waiting.length > 0) {
        const next = waiting[0];
        await sheets.updateQueueStatus(next.queue_number, { status: 'Serving' });

        // ── Emit to frontend to send "your turn" email via EmailJS ──
        if (next.email) {
          req.io.emit('send:email:turn', {
            patient_name: next.patient_name,
            queue_number: next.queue_number,
            department:   next.department,
            counter:      next.counter,
            email:        next.email,
          });
        }

        req.io.emit('queue:update', {
          nowServing:  next.queue_number,
          patientName: next.patient_name,
          department:  next.department,
          counter:     staff_counter,
        });
        
        return res.json({ success: true, action: 'call_next', queue_number: next.queue_number });
      }
      
      // No waiting patients
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

module.exports = router;