// app.js — AI CHART V+ frontend prototype
// - Handles signup/login via localStorage
// - Processes uploaded image on a canvas and runs a heuristic "price action" analyzer
// - Saves results and image data URL to localStorage per user (history)
// Note: This is a client-side prototype. Replace the heuristic analyzer with server/ML backed pipeline for production.

const LS_USERS = 'aiChartVPlus_users';
const LS_CURRENT = 'aiChartVPlus_currentUser';

const fileInput = document.getElementById('file-input');
const btnScan = document.getElementById('btn-scan');
const logsEl = document.getElementById('logs');
const resultCard = document.getElementById('result-card');
const resultSignal = document.getElementById('result-signal');
const resultReason = document.getElementById('result-reason');
const resultEntry = document.getElementById('result-entry');
const resultSL = document.getElementById('result-sl');
const resultTP = document.getElementById('result-tp');
const btnSaveHistory = document.getElementById('btn-save-history');
const btnDownloadImage = document.getElementById('btn-download-image');
const historyList = document.getElementById('history-list');
const scanCanvas = document.getElementById('scan-canvas');
const ctx = scanCanvas.getContext('2d');

const btnShowInfo = document.getElementById('btn-show-info');
const modalInfo = document.getElementById('modal-info');
const modalInfoClose = document.getElementById('modal-info-close');

const modalAuth = document.getElementById('modal-auth');
const modalAuthClose = document.getElementById('modal-auth-close');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const userGreeting = document.getElementById('user-greeting');

const formSignup = document.getElementById('form-signup');
const formLogin = document.getElementById('form-login');
const switchToLogin = document.getElementById('switch-to-login');
const switchToSignup = document.getElementById('switch-to-signup');

const btnClearHistory = document.getElementById('btn-clear-history');

let loadedImage = null;
let lastAnalysis = null;

// ------------------------- Utilities -------------------------
function log(msg){
  const time = new Date().toLocaleTimeString();
  logsEl.textContent += `[${time}] ${msg}\n`;
  logsEl.scrollTop = logsEl.scrollHeight;
}

// localStorage users handling
function readUsers(){
  try{
    const raw = localStorage.getItem(LS_USERS);
    return raw ? JSON.parse(raw) : [];
  }catch(e){ return [] }
}
function writeUsers(users){
  localStorage.setItem(LS_USERS, JSON.stringify(users));
}
function currentUser(){
  return JSON.parse(localStorage.getItem(LS_CURRENT) || 'null');
}
function setCurrentUser(user){
  localStorage.setItem(LS_CURRENT, JSON.stringify(user));
  renderAuthState();
}
function clearCurrentUser(){
  localStorage.removeItem(LS_CURRENT);
  renderAuthState();
}

// Per-user history storage key
function historyKeyFor(email){
  return `aiChartVPlus_history_${email}`;
}

// ------------------------- Auth UI -------------------------
function renderAuthState(){
  const u = currentUser();
  if(u){
    userGreeting.textContent = `Hi, ${u.name}`;
    btnLogin.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    document.getElementById('user-greeting').title = u.email;
    loadHistory();
  } else {
    userGreeting.textContent = '';
    btnLogin.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    renderHistoryEmpty();
  }
}

btnShowInfo.addEventListener('click', ()=>{ modalInfo.classList.remove('hidden') });
modalInfoClose.addEventListener('click', ()=>{ modalInfo.classList.add('hidden') });

btnLogin.addEventListener('click', ()=>{ modalAuth.classList.remove('hidden') });
modalAuthClose.addEventListener('click', ()=>{ modalAuth.classList.add('hidden') });

switchToLogin.addEventListener('click', ()=>{ formSignup.classList.add('hidden'); formLogin.classList.remove('hidden') });
switchToSignup.addEventListener('click', ()=>{ formLogin.classList.add('hidden'); formSignup.classList.remove('hidden') });

formSignup.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('su-name').value.trim();
  const phone = document.getElementById('su-phone').value.trim();
  const email = document.getElementById('su-email').value.trim().toLowerCase();
  const pin = document.getElementById('su-pin').value.trim();
  if(!name || !email || !pin){ alert('Please fill all fields'); return; }
  let users = readUsers();
  if(users.find(u=>u.email===email)){ alert('Account with that email already exists. Login instead.'); return; }
  const user = {name, phone, email, pin};
  users.push(user); writeUsers(users);
  setCurrentUser(user);
  log('Account created and logged in.');
  modalAuth.classList.add('hidden');
});

formLogin.addEventListener('submit', (e)=>{
  e.preventDefault();
  const email = document.getElementById('li-email').value.trim().toLowerCase();
  const pin = document.getElementById('li-pin').value.trim();
  const users = readUsers();
  const u = users.find(x=>x.email===email && x.pin===pin);
  if(!u){ alert('Invalid credentials'); return; }
  setCurrentUser(u);
  log('Logged in.');
  modalAuth.classList.add('hidden');
});

btnLogout.addEventListener('click', ()=>{
  clearCurrentUser();
  log('Logged out.');
});

// ------------------------- File upload & UI -------------------------
fileInput.addEventListener('change', async (e)=>{
  const f = e.target.files && e.target.files[0];
  if(!f) { btnScan.disabled = true; return; }
  const img = await loadImageFromFile(f);
  loadedImage = img;
  btnScan.disabled = false;
  log(`Loaded image: ${f.name} (${Math.round(f.size/1024)} KB). Ready to scan.`);
  // show thumbnail in result area
  resultCard.classList.add('hidden');
});

btnScan.addEventListener('click', async ()=>{
  if(!loadedImage){ alert('Please upload an image first'); return; }
  runScanWorkflow(loadedImage);
});

btnSaveHistory.addEventListener('click', ()=>{
  const u = currentUser();
  if(!u){ alert('Please login to save history.'); return; }
  if(!lastAnalysis) { alert('Nothing to save'); return; }
  const key = historyKeyFor(u.email);
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  hist.unshift(lastAnalysis);
  // keep last 100
  localStorage.setItem(key, JSON.stringify(hist.slice(0,100)));
  log('Saved analysis to history.');
  loadHistory();
});

// Download scanned image
btnDownloadImage.addEventListener('click', ()=>{
  if(!lastAnalysis || !lastAnalysis.imageData){ alert('No image to download'); return; }
  const a = document.createElement('a');
  a.href = lastAnalysis.imageData;
  a.download = `ai-chartvplus-${(new Date()).toISOString()}.png`;
  a.click();
});

// Clear history
btnClearHistory.addEventListener('click', ()=>{
  const u = currentUser();
  if(!u){ alert('Login to clear your history'); return; }
  if(!confirm('Clear your saved history?')) return;
  localStorage.removeItem(historyKeyFor(u.email));
  loadHistory();
  log('History cleared.');
});

// ------------------------- History rendering -------------------------
function renderHistoryEmpty(){
  historyList.innerHTML = `<p class="muted">No uploads yet. Upload a chart to start scanning.</p>`;
}
function loadHistory(){
  const u = currentUser();
  if(!u){ renderHistoryEmpty(); return; }
  const key = historyKeyFor(u.email);
  const hist = JSON.parse(localStorage.getItem(key) || '[]');
  if(!hist.length){ renderHistoryEmpty(); return; }
  historyList.innerHTML = '';
  hist.forEach((entry, idx)=>{
    const el = document.createElement('div');
    el.className = 'history-item';
    const thumbs = document.createElement('img');
    thumbs.className = 'history-thumb';
    thumbs.src = entry.imageData;
    thumbs.alt = `Upload ${idx+1}`;
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const title = document.createElement('div');
    title.className = 'meta-title';
    title.textContent = `${entry.signal} • ${entry.timestamp}`;
    const small = document.createElement('div');
    small.className = 'meta-small';
    small.textContent = `${entry.reasonSummary} • Entry:${entry.entry} SL:${entry.sl} TP:${entry.tp}`;
    meta.appendChild(title); meta.appendChild(small);
    const openBtn = document.createElement('button');
    openBtn.className = 'neon-btn ghost';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', ()=>{
      // show in result card
      showResult(entry);
      window.scrollTo({top:0,behavior:'smooth'});
    });
    el.appendChild(thumbs);
    el.appendChild(meta);
    el.appendChild(openBtn);
    historyList.appendChild(el);
  });
}

// ------------------------- Image scan workflow -------------------------
async function runScanWorkflow(img){
  logsEl.textContent = '';
  resultCard.classList.add('hidden');
  log('Preparing to scan image with price-action heuristic...');
  // Simulated progress messages
  log('Step 1: Preprocessing image...');
  await sleep(400);
  log('Step 2: Detecting chart area and scales (approx)...');
  await sleep(700);
  log('Step 3: Extracting candle-like features...');
  await sleep(600);
  // Run analysis
  const analysis = analyzeChartImage(img);
  lastAnalysis = {
    ...analysis,
    timestamp: new Date().toLocaleString()
  };
  showResult(lastAnalysis);
  log('Scan complete.');
}

// small sleep helper
function sleep(ms){ return new Promise(res=>setTimeout(res, ms)); }

// Load image from file to HTMLImageElement
function loadImageFromFile(file){
  return new Promise((resolve,reject)=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img) };
    img.onerror = e=>{ URL.revokeObjectURL(url); reject(e) };
    img.src = url;
  });
}

// Show analysis result in UI
function showResult(analysis){
  resultCard.classList.remove('hidden');
  resultSignal.textContent = analysis.signal;
  resultReason.textContent = analysis.reason;
  resultEntry.textContent = analysis.entry;
  resultSL.textContent = analysis.sl;
  resultTP.textContent = analysis.tp;
  // keep image data for download/historic
  if(analysis.imageData) {
    // no thumbnail in UI here; history holds images
  }
}

// ------------------------- Price-action heuristic analyzer -------------------------
/*
  The analyzer below is a heuristic, client-side, image-space processor.
  It performs:
  - Draw image to canvas, downsample
  - Convert to grayscale and compute column brightness profile
  - Detect a centroid per column (bright pixel position) to approximate price path
  - Run linear regression on centroids to estimate slope (trend)
  - Detect recent momentum by comparing last segment vs previous
  - Detect simple 'swing' support/resistance from local minima/maxima of centroids
  - Output a signal (BUY / SELL / NEUTRAL), an explanation, and SL/TP estimates as percentages.
  Notes:
  - Pixel-space does not equal price units. SL/TP are estimated percent moves computed from detected range.
  - Replace this with a proper candlestick parser / ML model + market price mapping for production use.
*/
function analyzeChartImage(img){
  // Draw image to canvas at a controlled size
  const maxW = 700, maxH = 420;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  const w = Math.max(200, Math.round(img.width * scale));
  const h = Math.max(120, Math.round(img.height * scale));
  scanCanvas.width = w; scanCanvas.height = h;
  ctx.clearRect(0,0,w,h);
  // draw with slight margin crop, to avoid UI overlays in screenshots
  ctx.drawImage(img, 0, 0, w, h);

  // Save full image data URL for history/download
  const imageDataURL = scanCanvas.toDataURL('image/png');

  // Get image data
  const data = ctx.getImageData(0,0,w,h).data;

  // Convert to grayscale matrix and compute column centroids (weighted by brightness)
  const centroids = []; // y position per column (0..h)
  const columnBrightness = [];
  for(let x=0;x<w;x++){
    let sumB = 0, sumY = 0;
    for(let y=0;y<h;y++){
      const i = (y*w + x)*4;
      // brightness
      const r = data[i], g = data[i+1], b = data[i+2];
      // Some chart backgrounds are light/dark; weight by luminance
      const lum = 0.299*r + 0.587*g + 0.114*b;
      // But price lines and candles are often high-contrast; use inverted lum to highlight dark candles on light bg
      const weight = 255 - lum; // brighter pixel => lower weight, dark => higher
      sumB += weight;
      sumY += weight * y;
    }
    if(sumB > 0){
      centroids.push(sumY / sumB);
      columnBrightness.push(sumB / h);
    } else {
      centroids.push(h/2);
      columnBrightness.push(0);
    }
  }

  // Smooth centroids with moving average
  const smooth = movingAverage(centroids, 5);

  // Linear regression on the centroids to get slope
  const slope = linearSlope(smooth);

  // Trend decision (pixel slope to percent style)
  // Positive slope (down in pixels) => price falling since y increases downwards; so invert slope sign
  const invSlope = -slope;
  const slopeThreshold = 0.02; // tuned experimentally; larger => needs stronger slope
  let trend = 'Neutral';
  if(invSlope > slopeThreshold) trend = 'Uptrend';
  else if(invSlope < -slopeThreshold) trend = 'Downtrend';

  // Detect local swings (support/resistance) - simple extrema in smooth centroid
  const swings = findLocalExtrema(smooth, 8);
  const recentSwing = swings.length ? swings[swings.length - 1] : null;

  // Recent momentum: compare mean of last 10 columns vs previous 10
  const tail = smooth.slice(-10);
  const prev = smooth.slice(-20,-10);
  const tailMean = mean(tail);
  const prevMean = mean(prev);
  const momentum = prevMean - tailMean; // positive => price moved up recently (since y increases down)
  let momentumLabel = 'Neutral';
  if(momentum > 1.0) momentumLabel = 'Bullish momentum';
  else if(momentum < -1.0) momentumLabel = 'Bearish momentum';

  // Determine a signal using combined rules
  // If trend up and bullish momentum => BUY; If trend down & bearish => SELL; else NEUTRAL
  let signal = 'NEUTRAL';
  if(trend === 'Uptrend' && momentumLabel === 'Bullish momentum') signal = 'BUY';
  else if(trend === 'Downtrend' && momentumLabel === 'Bearish momentum') signal = 'SELL';
  else {
    // look for reversal patterns: strong tail wick (last column brightness high relative to adjacent)
    const lastCol = columnBrightness[w-1] || 0;
    const prevCol = columnBrightness[w-2] || 0;
    if(lastCol > prevCol * 1.7 && momentumLabel === 'Bullish momentum') signal = 'BUY';
    else if(lastCol > prevCol * 1.7 && momentumLabel === 'Bearish momentum') signal = 'SELL';
  }

  // Estimate "entry" as last visible price (we map pixel to normalized 0..100)
  const lastY = smooth[smooth.length-1];
  const minY = Math.min(...smooth);
  const maxY = Math.max(...smooth);
  const normalized = (maxY - lastY) / (maxY - minY + 1e-9); // 0..1, 1 = top (higher price)
  const entryPct = (normalized * 100).toFixed(2) + '% (relative)';
  // Determine SL and TP as percent moves from entry (heuristic RR 1:2)
  // Use range to estimate percentage magnitude
  const range = Math.abs(maxY - minY) + 1e-9;
  // SL buffer pixels (heuristic)
  const slPixels = Math.max(6, Math.round(range * 0.05));
  const tpPixels = Math.max(12, Math.round(range * 0.10));
  // convert to relative %
  const slPct = ((slPixels / Math.max(h,1)) * 100).toFixed(2) + '%';
  const tpPct = ((tpPixels / Math.max(h,1)) * 100).toFixed(2) + '%';

  // Build reason summary
  const reasonLines = [];
  reasonLines.push(`Trend: ${trend} (slope=${invSlope.toFixed(4)})`);
  reasonLines.push(`Momentum: ${momentumLabel}`);
  if(recentSwing) reasonLines.push(`Recent swing ${recentSwing.type} at relative ${(100*(1 - recentSwing.y/h)).toFixed(1)}%`);
  reasonLines.push(`Heuristic: signal derived from trend+momentum rules`);
  const reason = reasonLines.join('. ');

  // Prepare a short reason summary for history list
  const reasonSummary = `${trend} • ${momentumLabel}`;

  // Return structured analysis
  const out = {
    signal,
    reason,
    reasonSummary,
    entry: entryPct,
    sl: slPct,
    tp: tpPct,
    slope: invSlope,
    imageData: imageDataURL,
    meta: {
      width: w, height: h
    }
  };
  return out;
}

// ------------------------- Small signal helpers -------------------------
function movingAverage(arr, k){
  const out = [];
  for(let i=0;i<arr.length;i++){
    let start = Math.max(0, i - Math.floor(k/2));
    let end = Math.min(arr.length, i + Math.floor(k/2) + 1);
    let s=0,c=0;
    for(let j=start;j<end;j++){ s+=arr[j]; c++ }
    out.push(s / Math.max(1,c));
  }
  return out;
}
function mean(a){ if(!a.length) return 0; return a.reduce((s,x)=>s+x,0)/a.length; }

// Linear regression slope on array of y-values vs x index (returns slope per index)
function linearSlope(y){
  const n = y.length;
  if(n < 2) return 0;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for(let i=0;i<n;i++){
    const x = i;
    const yy = y[i];
    sumX += x; sumY += yy; sumXY += x*yy; sumXX += x*x;
  }
  const denom = (n*sumXX - sumX*sumX) || 1;
  const slope = (n*sumXY - sumX*sumY) / denom;
  // Normalize slope by image height to make threshold stable across sizes
  return slope / n;
}

// Find local minima and maxima, returns array of {index, y, type}
function findLocalExtrema(arr, window){
  const out = [];
  for(let i=window;i<arr.length-window;i++){
    const v = arr[i];
    let isMax = true, isMin = true;
    for(let k=i-window;k<=i+window;k++){
      if(arr[k] > v) isMax = false;
      if(arr[k] < v) isMin = false;
    }
    if(isMax) out.push({index:i, y:v, type:'resistance'});
    if(isMin) out.push({index:i, y:v, type:'support'});
  }
  return out;
}

// ------------------------- Init -------------------------
renderAuthState();
loadHistory();

// show small UI disclaimer
log('Welcome to AI CHART V+ — client-side prototype. Signals are algorithmic and not financial advice.');
log('To begin: sign up or login (stored locally), then upload a chart screenshot and Scan.');

// Expose for debugging (optional)
window._aiChart = {
  analyzeChartImage
};