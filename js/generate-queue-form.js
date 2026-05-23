// ── EmailJS ──
const EMAILJS_PUBLIC_KEY = 'T-ZJmQESJPMXU_G3X';
const EMAILJS_SERVICE_ID = 'service_1vqqs89';

emailjs.init(EMAILJS_PUBLIC_KEY);

// ── Socket.io connection (declared once at the top) ──
const socket = io();

socket.on('connect', () => {
  console.log('[GenerateForm] Socket connected for email notifications:', socket.id);
});

// ── Form ──
const generateQueueForm = document.getElementById('generate-queue-form');
const queueFormCard = document.getElementById('queue-form-card');

generateQueueForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let isValid = true;

  const departmentSelect = document.getElementById('department');
  const departmentError = document.getElementById('department-error');
  const fullnameInput = document.getElementById('fullname');
  const fullnameError = document.getElementById('fullname-error');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const mobileInput = document.getElementById('mobile');
  const mobileError = document.getElementById('mobile-error');

  // Validate department
  if (!departmentSelect.value) {
    departmentError.hidden = false;
    departmentSelect.setAttribute('aria-invalid', 'true');
    isValid = false;
  } else {
    departmentError.hidden = true;
    departmentSelect.removeAttribute('aria-invalid');
  }

  // Validate full name
  if (!fullnameInput.value.trim()) {
    fullnameError.hidden = false;
    fullnameInput.setAttribute('aria-invalid', 'true');
    isValid = false;
  } else {
    fullnameError.hidden = true;
    fullnameInput.removeAttribute('aria-invalid');
  }

  // Validate email
  if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
    emailError.hidden = false;
    emailInput.setAttribute('aria-invalid', 'true');
    isValid = false;
  } else {
    emailError.hidden = true;
    emailInput.removeAttribute('aria-invalid');
  }

  // Validate mobile
  if (!/^09\d{9}$/.test(mobileInput.value.trim())) {
    mobileError.hidden = false;
    mobileInput.setAttribute('aria-invalid', 'true');
    isValid = false;
  } else {
    mobileError.hidden = true;
    mobileInput.removeAttribute('aria-invalid');
  }

  if (!isValid) return;

  const submitBtn = document.getElementById('get-queue-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating...';

  try {
    const email = emailInput.value.trim();

    const response = await fetch('/api/queue/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department: departmentSelect.options[departmentSelect.selectedIndex].text,
        fullname: fullnameInput.value.trim(),
        mobile: mobileInput.value.trim(),
        email,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to generate queue.');
    }

    const data = await response.json();

    // ── Store queue number for page switcher navigation ──
    sessionStorage.setItem('lastQueueNumber', data.queueNumber);
    sessionStorage.setItem('lastDepartment', data.department);
    sessionStorage.setItem('lastFullname', data.fullname);

    // ── Clear any previous QR so status.js doesn't use a stale one ──
    sessionStorage.removeItem('lastQRDataURL');

    // ── Send "Almost Your Turn" email if position is 1 (first in line) ──
    if (data.position === 1) {
      console.log(`[AlmostTurn] Position is 1, sending almost turn email to ${email}`);

      if (socket.connected) {
        socket.emit('notify:almost', {
          email: email,
          patient_name: data.fullname,
          queue_number: data.queueNumber,
          department: data.department,
          counter: data.counter,
          patients_ahead: 0,
        });
      } else {
        socket.once('connect', () => {
          socket.emit('notify:almost', {
            email: email,
            patient_name: data.fullname,
            queue_number: data.queueNumber,
            department: data.department,
            counter: data.counter,
            patients_ahead: 0,
          });
        });
      }
    }

    showResultCard(data, email);

  } catch (err) {
    console.error('Queue generation failed:', err);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get Queue Number';
    alert('Something went wrong. Please try again.');
  }
});

function showResultCard(data, email = '') {
  const maskedMobile = data.mobile.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 *** $3');

  queueFormCard.innerHTML = `
    <div style="text-align:center; margin-bottom: 1rem;">
      <p style="font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:#9CA3AF; margin-bottom:.5rem;">
        Your Queue Number
      </p>
      <p style="font-family:'Geist Mono',monospace; font-size:56px; font-weight:700; color:#0066FF; line-height:1; margin-bottom:.5rem;">
        ${data.queueNumber}
      </p>
      <span style="display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600;
        padding:3px 10px; border-radius:5px; background:#F0FDF4; color:#15803D; border:1px solid #BBF7D0;">
        Confirmed
      </span>
    </div>

    <hr style="border:none; height:1px; background:#E5E7EB; margin:1rem 0;" aria-hidden="true">

    <dl style="display:flex; flex-direction:column; gap:.5rem; font-size:13px; margin-bottom:1rem;">
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Name</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(data.fullname)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Mobile</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(maskedMobile)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Email</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(email)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Department</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(data.department)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Counter</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(data.counter)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Position</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${data.position}${ordinal(data.position)} in line</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Est. Wait</dt>
        <dd style="color:#EA6C00; font-weight:500; margin:0;">${escapeHtml(data.estimatedWait)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Date</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(data.generatedDate)}</dd>
      </div>
      <div style="display:flex; gap:.5rem;">
        <dt style="color:#6B7280; width:110px; flex-shrink:0;">Time</dt>
        <dd style="color:#111827; font-weight:500; margin:0;">${escapeHtml(data.generatedAt)}</dd>
      </div>
    </dl>

    <div id="qr-output" style="display:flex; justify-content:center; margin-bottom:.75rem;">
      <div style="padding:8px; border:1px solid #E5E7EB; border-radius:7px; background:white;">
        <div id="qr-div" style="display:flex; justify-content:center; align-items:center; min-height:120px;"></div>
      </div>
    </div>

    <p style="text-align:center; font-size:12px; color:#9CA3AF; margin-bottom:1rem;">
      Show this QR code at the counter
    </p>

    <button
      id="download-pdf-btn"
      type="button"
      class="cursor-pointer"
      style="width:100%; height:36px; display:flex; align-items:center; justify-content:center; gap:6px;
        border:1px solid #E5E7EB; border-radius:7px; font-size:13px; font-weight:500;
        color:#374151; background:white; cursor:pointer; font-family:inherit; margin-bottom:.5rem;"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" x2="12" y1="15" y2="3"/>
      </svg>
      Download Queue Card
    </button>

    <button
      id="new-queue-btn"
      type="button"
      class="cursor-pointer"
      style="width:100%; height:36px; display:flex; align-items:center; justify-content:center;
        border:none; background:none; font-size:13px; color:#6B7280; cursor:pointer; font-family:inherit;"
    >
      ← Generate another queue
    </button>

    <hr style="border:none; height:1px; background:#E5E7EB; margin:1rem 0;" aria-hidden="true">

    <div style="text-align:center; margin-top:0.5rem;">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="#6B7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
        style="display:inline-block; margin-bottom:4px;">
        <rect width="20" height="16" x="2" y="4" rx="2"/>
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
      </svg>
      <p style="font-size:12px; color:#6B7280; margin:0;">
        Email notification will be sent to <strong style="color:#374151;">${escapeHtml(email)}</strong>
      </p>
    </div>
  `;

  // Generate QR code and store reference for PDF
  generateAndStoreQR(data.queueNumber, data);

  document.getElementById('new-queue-btn').addEventListener('click', resetForm);
}

// ── Store QR data URL globally for PDF access ──
let currentQRDataURL = null;
let currentQueueData = null;

function generateAndStoreQR(queueNumber, queueData) {
  const div = document.getElementById('qr-div');
  if (!div) {
    console.error('QR div not found');
    return;
  }

  div.innerHTML = '';
  div.style.display = 'flex';
  div.style.justifyContent = 'center';
  div.style.alignItems = 'center';

  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.style.cssText = 'width:120px;height:120px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#9CA3AF;';
  loadingDiv.textContent = 'Generating QR...';
  div.appendChild(loadingDiv);

  if (typeof QRCode === 'undefined') {
    div.innerHTML = '<p style="font-size:12px;color:#9CA3AF;">QR code unavailable</p>';
    currentQRDataURL = null;
    return;
  }

  const qrContainer = document.createElement('div');
  qrContainer.id = 'qr-code-container';
  div.innerHTML = '';
  div.appendChild(qrContainer);

  new QRCode(qrContainer, {
    text: queueNumber,
    width: 120,
    height: 120,
    colorDark: '#0A0A0A',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.H,
  });

  const captureQRAsDataURL = () => {
    // Try img element first
    const qrImg = qrContainer.querySelector('img');
    if (qrImg && qrImg.complete && qrImg.src) {
      currentQRDataURL = qrImg.src;
      currentQueueData = queueData;

      // ── Save to sessionStorage so status.js can use it ──
      sessionStorage.setItem('lastQRDataURL', currentQRDataURL);
      console.log('[QR] Captured from img, saved to sessionStorage');

      attachDownloadButton();
      return;
    }

    // Try canvas element
    const qrCanvas = qrContainer.querySelector('canvas');
    if (qrCanvas) {
      try {
        currentQRDataURL = qrCanvas.toDataURL('image/png');
        currentQueueData = queueData;

        // ── Save to sessionStorage so status.js can use it ──
        sessionStorage.setItem('lastQRDataURL', currentQRDataURL);
        console.log('[QR] Captured from canvas, saved to sessionStorage');

        attachDownloadButton();
        return;
      } catch (e) {
        console.warn('Failed to capture QR from canvas:', e);
      }
    }

    // Not ready yet, retry
    setTimeout(captureQRAsDataURL, 100);
  };

  setTimeout(captureQRAsDataURL, 200);
}

function attachDownloadButton() {
  const downloadBtn = document.getElementById('download-pdf-btn');
  if (downloadBtn) {
    const newDownloadBtn = downloadBtn.cloneNode(true);
    downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
    newDownloadBtn.addEventListener('click', () => downloadPDF());
  }
}

function downloadPDF() {
  if (typeof window.jspdf === 'undefined') {
    alert('PDF download is not available yet.');
    return;
  }

  if (!currentQueueData) {
    alert('Queue data not available. Please try again.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const W = 105;
  const H = 175;
  const doc = new jsPDF({ unit: 'mm', format: [W, H] });
  const data = currentQueueData;
  const maskedMobile = data.mobile.replace(/^(\d{4})(\d{3})(\d{4})$/, '$1 *** $3');

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('MedQueue', W / 2, 14, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130);
  doc.text('HOSPITAL QUEUEING SYSTEM', W / 2, 20, { align: 'center' });

  doc.setFontSize(42);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 102, 255);
  doc.text(data.queueNumber, W / 2, 38, { align: 'center' });

  doc.setDrawColor(220);
  doc.line(10, 44, W - 10, 44);

  const labelX = 14;
  const valueX = 52;
  const rows = [
    ['Name', data.fullname],
    ['Mobile', maskedMobile],
    ['Department', data.department],
    ['Counter', data.counter],
    ['Position', `${data.position}${ordinal(data.position)} in line`],
    ['Est. Wait', data.estimatedWait],
    ['Date', data.generatedDate],
    ['Time', data.generatedAt],
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

  if (currentQRDataURL) {
    try {
      const qrSize = 32;
      const qrX = (W - qrSize) / 2;
      doc.addImage(currentQRDataURL, 'PNG', qrX, y + 6, qrSize, qrSize);
      y += qrSize + 10;
      console.log('[PDF] QR added successfully');
    } catch (e) {
      console.warn('[PDF] QR embed failed:', e);
      y += 6;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('QR Code', W / 2, y + 20, { align: 'center' });
    }
  } else {
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('QR Code', W / 2, y + 20, { align: 'center' });
  }

  doc.setDrawColor(220);
  doc.line(10, y + 2, W - 10, y + 2);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Please stay nearby the waiting area and keep your phone on.', W / 2, y + 9, { align: 'center' });
  doc.text('Email notification will be sent before your turn.', W / 2, y + 14, { align: 'center' });

  doc.save(`QueueCard-${data.queueNumber}.pdf`);
}

function resetForm() {
  currentQRDataURL = null;
  currentQueueData = null;
  sessionStorage.removeItem('lastQRDataURL');
  window.location.reload();
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}