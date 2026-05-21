// ── status.js — QR Status Page ──
// Reads ?queue=Q023&dept=GeneralMedicine from the URL

const params = new URLSearchParams(window.location.search);
let currentData = {};
let currentQRCanvas = null;
const queueNum = params.get('queue');

// ── On page load ──
if (queueNum) {
  loadQueueStatus(queueNum);
} else {
  showError('No queue number found. Please scan your QR code again.');
}

async function loadQueueStatus(queue) {
  try {
    const res = await fetch(`/api/queue/status?queue=${encodeURIComponent(queue)}`);
    
    if (!res.ok) {
      showError('Queue number not found. Please scan your QR code again.');
      return;
    }
    
    const data = await res.json();
    currentData = data;
    renderStatus(data);

    document.getElementById('page-loader').hidden = true;
    document.getElementById('main-content').hidden = false;
    
  } catch (err) {
    console.error('Failed to load queue status:', err);
    document.getElementById('page-loader').hidden = true;
    showError('Could not load your queue status. Please try again.');
  }
}

function renderStatus(data) {
  const isServing = data.status === 'Serving';
  const isCompleted = data.status === 'Completed';
  
  // ── Your queue number card ──
  const queueHeading = document.getElementById('your-queue-heading');
  if (queueHeading) queueHeading.textContent = data.queue_number;
  
  // Status badge
  const statusBadgeEl = queueHeading?.nextElementSibling;
  if (statusBadgeEl) {
    statusBadgeEl.textContent = isServing ? 'Now Serving' : isCompleted ? 'Completed' : 'Waiting';
    statusBadgeEl.className = isServing
      ? 'mb-1.5 text-xs font-medium px-2 py-0.5 rounded-[5px] bg-teal-50 text-teal-700'
      : isCompleted
        ? 'mb-1.5 text-xs font-medium px-2 py-0.5 rounded-[5px] bg-green-50 text-green-700'
        : 'mb-1.5 text-xs font-medium px-2 py-0.5 rounded-[5px] bg-gray-100 text-gray-500';
  }
  
  // Patient name greeting
  const greetingEl = document.querySelector('#your-queue-card p.text-\\[18px\\]');
  if (greetingEl) greetingEl.textContent = `Hello, ${data.patient_name ? data.patient_name.split(' ')[0] : 'Patient'}.`;
  
  // Department and counter
  const dds = document.querySelectorAll('#your-queue-card dd');
  if (dds[0]) dds[0].textContent = data.department || '—';
  if (dds[1]) dds[1].textContent = data.counter || '—';
  
  // ── Position & wait card ──
  const position = data.position || 0;
  const positionEl = document.querySelector('#position-card p.font-mono:first-of-type');
  if (positionEl) positionEl.textContent = `${position}${ordinal(position)}`;
  
  const waitEl = document.querySelector('#position-card p.font-mono:last-of-type');
  if (waitEl) waitEl.textContent = data.estimated_wait || '—';
  
  // Progress bar
  const progressBar = document.querySelector('[role="progressbar"] div');
  const progressPct = Math.max(5, 100 - (position - 1) * 15);
  if (progressBar) progressBar.style.width = `${progressPct}%`;
  
  const nowServingLabel = document.querySelector('#position-card p.text-right');
  if (nowServingLabel) nowServingLabel.textContent = `Now Serving: ${data.now_serving || '—'}`;
  
  // ── Queue Around You ──
  renderNearbyList(data.nearby, data.queue_number);
  
  // ── SMS notice ──
  const smsNumberEl = document.querySelector('#sms-alert-notice span.text-xs');
  if (smsNumberEl && data.mobile) {
    const masked = data.mobile.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 *** $3');
    smsNumberEl.textContent = masked;
  }
  
  // ── Generate QR code using qrcodejs (matching index.html) ──
  const qrContainer = document.querySelector('#qr-code-card .p-2');
  if (qrContainer) {
    // Clear container
    qrContainer.innerHTML = '';
    
    // Create div for QR code
    const qrDiv = document.createElement('div');
    qrDiv.id = 'qrcode';
    qrContainer.appendChild(qrDiv);
    
    // QR code data (URL to this same page)
    const qrValue = `${window.location.origin}/queue-status.html?queue=${data.queue_number}`;
    
    // Generate using QRCodejs
    new QRCode(qrDiv, {
      text: qrValue,
      width: 120,
      height: 120,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
    
    // Store reference for download
    currentQRCanvas = qrDiv.querySelector('canvas');
  }
  
  // ── Add download button handler ──
  const downloadBtn = document.querySelector('#qr-code-card button');
  if (downloadBtn) {
    // Remove existing event listeners
    const newBtn = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newBtn, downloadBtn);
    
    newBtn.addEventListener('click', function() {
      downloadQueueCard();
    });
  }
}

function renderNearbyList(nearby, myQueue) {
  const list = document.querySelector('#queue-around-card ol');
  if (!list || !nearby) return;
  
  list.innerHTML = nearby.map((item) => {
    const isYou = item.queue_number === myQueue;
    const isCompleted = item.status === 'Completed';
    const isServing = item.status === 'Serving';
    
    let badge = '';
    if (isCompleted) {
      badge = `<span class="text-xs font-medium px-2 py-0.5 rounded-[5px] bg-green-50 text-green-700 border border-green-200">Completed</span>`;
    } else if (isServing) {
      badge = `<span class="text-xs font-medium px-2 py-0.5 rounded-[5px] bg-[#EFF5FF] text-[#0052CC] border border-blue-200">Now Serving</span>`;
    } else {
      badge = `<span class="text-xs font-medium px-2 py-0.5 rounded-[5px] bg-gray-50 text-gray-500 border border-gray-200">Waiting</span>`;
    }
    
    const youPill = isYou
      ? `<span class="text-[11px] px-1.5 py-0.5 rounded-[4px] font-medium bg-blue-200 text-[#0052CC] ml-2">You</span>`
      : '';
    
    return `
      <li class="flex items-center justify-between h-9 border-b border-gray-100 last:border-0
        ${isYou ? 'border-l-2 border-l-[#0066FF] bg-[#EFF5FF] pl-2.5' : ''}"
        ${isYou ? 'aria-current="true"' : ''}>
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-gray-700">${item.queue_number}</span>
          ${youPill}
        </div>
        ${badge}
      </li>
    `;
  }).join('');
}

// ── Download Queue Card (PDF) - Matching index.html style ──
// ── Download Queue Card (EXACT same design as index.html) ──
function downloadQueueCard() {
  if (typeof window.jspdf === 'undefined') {
    alert('PDF download is not available yet.');
    return;
  }

  const queueNumber = currentData.queue_number || document.getElementById('your-queue-heading')?.textContent;
  const patientName = currentData.patient_name || 'Patient';
  const department = currentData.department || '—';
  const counter = currentData.counter || '—';
  const position = currentData.position || 0;
  const estimatedWait = currentData.estimated_wait || '—';
  const mobile = currentData.mobile || '—';
  
  // Mask mobile number
  const maskedMobile = mobile.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 *** $3');
  
  // Get current date/time
  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-PH');
  const generatedAt = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

  const { jsPDF } = window.jspdf;
  const W = 105;
  const H = 175;
  const doc = new jsPDF({ unit: 'mm', format: [W, H] });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('MedQueue', W / 2, 14, { align: 'center' });

  // Subheader
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130);
  doc.text('HOSPITAL QUEUEING SYSTEM', W / 2, 20, { align: 'center' });

  // Queue Number (big blue)
  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 255);
  doc.text(queueNumber, W / 2, 38, { align: 'center' });

  // Divider
  doc.setDrawColor(220);
  doc.line(10, 44, W - 10, 44);

  // Patient information rows
  const labelX = 14;
  const valueX = 52;
  const rows = [
    ['Name', patientName],
    ['Mobile', maskedMobile],
    ['Department', department],
    ['Counter', counter],
    ['Position', `${position}${ordinal(position)} in line`],
    ['Est. Wait', estimatedWait],
    ['Date', generatedDate],
    ['Time', generatedAt],
  ];

  doc.setFontSize(9);
  let y = 52;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130);
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20);
    doc.text(String(value), valueX, y);
    y += 7.5;
  });

  // Get QR code image
  const qrCanvas = document.querySelector('#qrcode canvas');
  if (qrCanvas) {
    const qrSize = 32;
    const qrX = (W - qrSize) / 2;
    const qrImage = qrCanvas.toDataURL('image/png');
    doc.addImage(qrImage, 'PNG', qrX, y + 6, qrSize, qrSize);
    y += qrSize + 10;
  } else {
    y += 6;
  }

  // Bottom divider
  doc.setDrawColor(220);
  doc.line(10, y + 2, W - 10, y + 2);

  // Footer text
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Please stay nearby the waiting area and keep your phone on.', W / 2, y + 9, { align: 'center' });
  doc.text('Email notification will be sent before your turn.', W / 2, y + 14, { align: 'center' });

  // Download
  doc.save(`QueueCard-${queueNumber}.pdf`);
}

// Helper function for ordinal numbers
function ordinal(n) {
  if (n === 0) return 'th';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// ── Socket.io for live updates ──
const socket = io();

socket.on('queue:update', (data) => {
  if (currentData.queue_number && data.queues) {
    const updated = data.queues.find(q => q.queue_number === currentData.queue_number);
    if (updated) {
      updated.now_serving = data.nowServing;
      updated.estimated_wait = data.estimatedWait;
      renderStatus(updated);
    }
  }
});

socket.on('queue:done', (data) => {
  if (data.queueNumber === currentData.queue_number) {
    renderStatus({ ...currentData, status: 'Completed', position: 0 });
  }
});

// ── Helpers ──
function ordinal(n) {
  if (n === 0) return 'th';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function showError(message) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `
    <div style="text-align:center; padding: 3rem 1rem;">
      <p style="font-size:15px; color:#374151; font-weight:600; margin-bottom:.5rem;">Something went wrong</p>
      <p style="font-size:13px; color:#6B7280; margin-bottom:1.5rem;">${message}</p>
      <a href="/" style="font-size:13px; color:#0066FF;">← Back to Queue Generator</a>
    </div>
  `;
}