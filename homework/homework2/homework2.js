/* Caesar app — separato da HTML, logica identica all'originale */
(() => {
  'use strict';

  const A = 'A'.charCodeAt(0);
  const letters = Array.from({length:26}, (_,i)=>String.fromCharCode(A+i));

  // Frequenze italiane (fallback per crack quando manca il plaintext)
  const ITALIAN_FREQ = (() => {
    const base = {
      A:.117, B:.009, C:.045, D:.037, E:.117, F:.011, G:.016, H:.012, I:.112,
      L:.065, M:.025, N:.068, O:.098, P:.030, Q:.005, R:.063, S:.049, T:.056,
      U:.030, V:.021, Z:.011
    };
    const fallback = {J:.001, K:.002, W:.001, X:.001, Y:.001};
    const map = {};
    for (let i=0;i<26;i++){
      const ch = String.fromCharCode(A+i);
      map[ch] = base[ch] ?? fallback[ch] ?? 0.001;
    }
    const s = Object.values(map).reduce((a,b)=>a+b,0);
    for (const k in map) map[k] /= s;
    return letters.map(ch => map[ch]);
  })();

  // ---- Normalizzazione e utilità
  function stripAccentsUpper(t){
    return t.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }
  function toAZ(text) { return stripAccentsUpper(text).replace(/[^A-Z]/g, ''); }

  function caesarEncryptAZ(t, k){
    const s = ((k % 26) + 26) % 26;
    return t.replace(/[A-Z]/g, ch => String.fromCharCode(A + ((ch.charCodeAt(0) - A + s) % 26)));
  }
  function caesarDecryptAZ(t, k){ return caesarEncryptAZ(t, -k); }

  function freqAZ(textAZ) {
    const counts = new Array(26).fill(0);
    let tot = 0;
    for (const ch of textAZ) { const i = ch.charCodeAt(0) - A; if (i>=0 && i<26){ counts[i]++; tot++; } }
    const rel = counts.map(c => tot ? c/tot : 0);
    return {counts, rel, tot};
  }

  // ---- Metriche
  function dot(a,b){ let s=0; for(let i=0;i<26;i++) s += a[i]*b[i]; return s; } // più alto = meglio
  function chiSquare(obsRel, expRel){ let s=0; for(let i=0;i<26;i++){ const o=obsRel[i], e=expRel[i]||1e-12; s += (o-e)*(o-e)/e; } return s; } // più basso = meglio

  // Stima k massimizzando la similarità con una distribuzione target nota (plaintext)
  function estimateShiftBySimilarity(cipherRel, targetRel){
    let bestK = 0, bestScore = -Infinity;
    for (let k=0; k<26; k++){
      // decrypt di k equivale a ruotare indietro di k
      const rotated = cipherRel.map((_,i)=> cipherRel[(i+k)%26]);
      const score = dot(rotated, targetRel);
      if (score > bestScore){ bestScore = score; bestK = k; }
    }
    return {k: bestK, score: bestScore};
  }

  // Fallback: se manca target, usa chi^2 contro l'italiano
  function estimateShiftByChiSquare(cipherRel){
    let bestK=0, best=Infinity;
    for (let k=0; k<26; k++){
      const rotated = cipherRel.map((_,i)=> cipherRel[(i+k)%26]);
      const s = chiSquare(rotated, ITALIAN_FREQ);
      if (s < best){ best = s; bestK = k; }
    }
    return {k: bestK, score: best};
  }

  // ---- Grafica
  function drawHistogram(canvas, labels, s1, s2) {
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.floor(W*dpr); canvas.height = Math.floor(H*dpr);
    ctx.scale(dpr,dpr);

    const m = {top:20,right:20,bottom:60,left:50};
    const w = W - m.left - m.right;
    const h = H - m.top - m.bottom;

    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,W,H);

    const maxVal = Math.max(...s1, ...s2, 0.15);
    const yTicks = 5;
    ctx.strokeStyle = '#e6eaf2';
    ctx.fillStyle = '#5f6b7a';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    for (let i=0;i<=yTicks;i++){
      const t = i/yTicks * maxVal;
      const y = m.top + h - (t/maxVal)*h;
      ctx.beginPath(); ctx.moveTo(m.left,y); ctx.lineTo(m.left+w,y); ctx.stroke();
      ctx.fillText((t*100).toFixed(0)+'%', 6, y-2);
    }

    const n = labels.length;
    const groupW = w/n;
    const gap = Math.min(4, groupW*0.1);
    const barW = (groupW-gap)/2;

    ctx.strokeStyle = '#cfd6e4';
    ctx.beginPath();
    ctx.moveTo(m.left, m.top);
    ctx.lineTo(m.left, m.top+h);
    ctx.lineTo(m.left+w, m.top+h);
    ctx.stroke();

    const colorPlain = '#4e79a7';
    const colorCipher = '#e15759';

    for (let i=0;i<n;i++){
      const x0 = m.left + i*groupW + gap/2;
      const y1 = m.top + h - (s1[i]/maxVal)*h;
      const y2 = m.top + h - (s2[i]/maxVal)*h;

      ctx.fillStyle = colorPlain; ctx.fillRect(x0, y1, barW, (m.top+h)-y1);
      ctx.fillStyle = colorCipher; ctx.fillRect(x0+barW, y2, barW, (m.top+h)-y2);

      ctx.save();
      ctx.translate(x0+barW, m.top+h+14);
      ctx.rotate(-Math.PI/8);
      ctx.fillStyle = '#2d3640';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    }
  }

  function updateTable(tbody, labels, s1, s2){
    tbody.innerHTML = '';
    for (let i=0;i<labels.length;i++){
      const tr = document.createElement('tr');
      const tdL = document.createElement('td'); tdL.textContent = labels[i];
      const tdP = document.createElement('td'); tdP.textContent = (s1[i]*100).toFixed(2);
      const tdC = document.createElement('td'); tdC.textContent = (s2[i]*100).toFixed(2);
      tr.append(tdL, tdP, tdC);
      tbody.appendChild(tr);
    }
  }

  // ---- Bind UI
  const plainEl   = document.getElementById('plain-input');
  const kEl       = document.getElementById('shift-input');
  const cipherEl  = document.getElementById('cipher-input');

  const analyzeBtn= document.getElementById('analyze-btn');
  const encBtn    = document.getElementById('enc-btn');
  const crackBtn  = document.getElementById('crack-btn');

  const outWrap   = document.getElementById('cipher-output');
  const outText   = document.getElementById('result-text');
  const metaLine  = document.getElementById('meta-line');

  const chartsWrap= document.getElementById('charts');
  const canvas    = document.getElementById('hist-canvas');
  const freqBody  = document.querySelector('#freq-table tbody');
  const nPlainEl  = document.getElementById('n-plain');
  const nCipherEl = document.getElementById('n-cipher');

  let lastData = null;
  let targetPlainRel = null;   // distribuzione del plaintext “originale”

  function renderChartAndTable(plainRel, cipherRel, nPlain, nCipher){
    chartsWrap.style.display = 'block';
    drawHistogram(canvas, letters, plainRel, cipherRel);
    updateTable(freqBody, letters, plainRel, cipherRel);
    nPlainEl.textContent = nPlain;
    nCipherEl.textContent = nCipher;
    lastData = {s1: plainRel, s2: cipherRel};
  }

  // 1) Analizza distribuzione plaintext e salvala come target
  analyzeBtn.addEventListener('click', () => {
    const plainAZ = toAZ(plainEl.value);
    const fPlain = freqAZ(plainAZ);
    targetPlainRel = fPlain.rel.slice(); // memorizza target
    renderChartAndTable(fPlain.rel, new Array(26).fill(0), fPlain.tot, 0);
    outWrap.style.display = 'block';
    outText.textContent = `Plaintext normalizzato (A–Z, N=${fPlain.tot})\n` + plainAZ.slice(0, 1000);
    metaLine.textContent = 'Target fissato: userò questa distribuzione per il crack per similarità.';
  });

  // 2) Cifra con k (facoltativo)
  encBtn.addEventListener('click', () => {
    const k = parseInt(kEl.value || '0', 10);
    const plainAZ = toAZ(plainEl.value);
    const cipherAZ = caesarEncryptAZ(plainAZ, k);
    cipherEl.value = cipherAZ;

    const fPlain = freqAZ(plainAZ);
    const fCipher = freqAZ(cipherAZ);
    if (!targetPlainRel) targetPlainRel = fPlain.rel.slice(); // se non analizzato, usa questo

    renderChartAndTable(fPlain.rel, fCipher.rel, fPlain.tot, fCipher.tot);
    outWrap.style.display = 'block';
    outText.textContent = `Ciphertext (k=${k}, N=${fCipher.tot})\n` + cipherAZ.slice(0, 1000);
    metaLine.textContent = 'Distribuzioni aggiornate.';
  });

  // 3) Crack: se ho targetPlainRel uso la similarità, altrimenti fallback chi^2 vs italiano
  crackBtn.addEventListener('click', () => {
    let cipherAZ = toAZ(cipherEl.value);
    if (!cipherAZ.length) cipherAZ = toAZ(plainEl.value); // comodità

    const fCipher = freqAZ(cipherAZ);
    if (fCipher.tot === 0) {
      outWrap.style.display = 'block';
      outText.textContent = 'Nessun ciphertext valido (A–Z) da analizzare.';
      metaLine.textContent = '';
      return;
    }

    let kBest, score, method;
    if (targetPlainRel) {
      ({k: kBest, score} = estimateShiftBySimilarity(fCipher.rel, targetPlainRel));
      method = `similarità (dot) vs distribuzione plaintext — score=${score.toFixed(3)}`;
    } else {
      ({k: kBest, score} = estimateShiftByChiSquare(fCipher.rel));
      method = `chi² vs italiano — chi²=${score.toFixed(3)}`;
    }

    const decrypted = caesarDecryptAZ(cipherAZ, kBest);
    const fPlainGuess = freqAZ(decrypted);

    renderChartAndTable(targetPlainRel || fPlainGuess.rel, fCipher.rel,
                        (targetPlainRel ? 1 : fPlainGuess.tot), fCipher.tot);
    outWrap.style.display = 'block';
    outText.textContent =
      `Crack completato: shift stimato k=${kBest}\n` +
      `Plaintext stimato (N=${fPlainGuess.tot}):\n` + decrypted.slice(0, 1000);
    metaLine.textContent = `Metodo: ${method}.`;
  });

  // Redraw on resize
  window.addEventListener('resize', () => {
    if (lastData) drawHistogram(canvas, letters, lastData.s1, lastData.s2);
  });
})();