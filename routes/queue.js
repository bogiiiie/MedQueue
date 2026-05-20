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
// New code (with department prefixes)
router.post('/generate', async (req, res) => {
  try {
    const { department, fullname, mobile, email } = req.body;
    
    // Get next queue number - NEW WAY (per department)
    const queueNumber = await sheets.getNextQueueNumberForDepartment(department);
    
    // Counter assignment (fixed per department)
    const counterAssignment = {
      'General Medicine': '1',
      'Pediatrics': '2',
      'Cardiology': '3',
      'Orthopedics': '4',
      'Emergency': '1'
    };
    const assignedCounter = counterAssignment[department] || '1';
    
    // Save to Google Sheets
    await sheets.addQueueEntry({
      queue_number: queueNumber,
      patient_name: fullname,
      mobile: mobile,
      email: email,
      department: department,
      assigned_counter: assignedCounter,
      status: 'Waiting',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Get position in queue
    const allQueues = await sheets.getAllQueues();
    const deptWaitingQueues = allQueues.filter(q => 
      q.department === department && 
      q.status === 'Waiting'
    );
    const position = deptWaitingQueues.length;
    const estimatedWait = `${position * 8} min`;
    
    res.json({
      success: true,
      queueNumber: queueNumber,
      department: department,
      counter: assignedCounter,
      fullname: fullname,
      mobile: mobile,
      position: position,
      estimatedWait: estimatedWait,
      generatedDate: new Date().toLocaleDateString('en-PH'),
      generatedAt: new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    });
    
  } catch (error) {
    console.error('Queue generation failed:', error);
    res.status(500).json({ error: error.message });
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

// ── Get counter status (open/closed) ──
router.get('/counter-status', async (req, res) => {
  try {
    const { counter } = req.query;
    
    if (!counter) {
      // Return all counter statuses
      const allStatuses = await sheets.getAllCounterStatuses();
      return res.json({ success: true, counters: allStatuses });
    }
    
    // Return specific counter status
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
    
    // Emit socket event para real-time update sa ibang clients
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