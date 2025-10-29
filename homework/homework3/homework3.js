// ===== Utilities =====
      const ALPH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const toNum = {}; const toChar = {};
      for (let i=0;i<26;i++){ toNum[ALPH[i]] = i; toChar[i] = ALPH[i]; }
      function normalizeText(s){ return (s||"").toUpperCase().replace(/[^A-Z]/g,""); }
      function gcd(a,b){ return b===0?Math.abs(a):gcd(b,a%b); }
      function egcd(a,b){ if(b===0) return [a,1,0]; const [g,x1,y1]=egcd(b,a%b); return [g,y1,x1-Math.floor(a/b)*y1]; }
      function modInv(a,m){ const [g,x]=egcd((a%m+m)%m,m); if(g!==1) throw new Error("No modular inverse"); return ((x%m)+m)%m; }
      function modPow(base, exp, mod){
        base = ((base%mod)+mod)%mod;
        let res = 1;
        while (exp > 0){
          if (exp & 1) res = (res * base) % mod;
          base = (base * base) % mod;
          exp >>= 1;
        }
        return res;
      }
      function countsFromArray(arr){ const map = new Map(); for (const v of arr) map.set(v, (map.get(v)||0)+1); return map; }
      function freqFromTextNormalized(norm){
        const counts = Array(26).fill(0);
        for (const ch of norm) counts[toNum[ch]]++;
        const total = Math.max(norm.length,1);
        const rel = counts.map(c=>c/total);
        return {counts, rel, total};
      }

      // ===== DOM refs =====
      const textInput = document.getElementById("text-input");
      const analyzeBtn = document.getElementById("analyze-btn");
      const clearBtn = document.getElementById("clear-btn");
      const histInput = document.getElementById("hist-input");
      const histCipher = document.getElementById("hist-cipher");
      const ctxIn = histInput.getContext("2d");
      const ctxCi = histCipher.getContext("2d");
      const freqPlainBody = document.querySelector("#freq-plain tbody");
      const freqCipherBody = document.querySelector("#freq-cipher tbody");

      const pField = document.getElementById("p-field");
      const qField = document.getElementById("q-field");
      const eField = document.getElementById("e-field");
      const pickPrimesBtn = document.getElementById("pick-primes");
      const recomputeKeyBtn = document.getElementById("recompute-key");
      const nVal = document.getElementById("n-val");
      const phiVal = document.getElementById("phi-val");
      const dVal = document.getElementById("d-val");

      const encryptBtn = document.getElementById("encrypt-btn");
      const decryptFreqBtn = document.getElementById("decrypt-freq-btn");
      const decryptTrueBtn = document.getElementById("decrypt-true-btn");
      const cipherOutput = document.getElementById("cipher-output");
      const plainNormSpan = document.getElementById("plain-norm");
      const plainNSpan = document.getElementById("plain-n");
      const cipherUnique = document.getElementById("cipher-unique");
      const guessedPlainTA = document.getElementById("guessed-plain");
      const truePlainTA = document.getElementById("true-plain");

      // ===== State =====
      let currentKey = null; // {p,q,e,n,phi,d}
      let lastCipherNums = [];
      let lastPlainNorm = "";

      // small primes for demo
      const SMALL_PRIMES = [3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127];

      function randomPrime(exclude){
        let p;
        do { p = SMALL_PRIMES[Math.floor(Math.random()*SMALL_PRIMES.length)]; } while (p === exclude);
        return p;
      }

      // ===== Drawing =====
      function drawSimpleBar(ctx, relArr, color, title){
        ctx.canvas.width = ctx.canvas.clientWidth;
        ctx.canvas.height = ctx.canvas.clientHeight;
        ctx.clearRect(0,0,ctx.canvas.width, ctx.canvas.height);
        const pad = 36;
        const w = ctx.canvas.width - pad*2;
        const h = ctx.canvas.height - pad*2;
        const barW = w / 26 * 0.8;
        const gap = (w - barW*26) / 25;
        let maxv = 0.0001;
        for (let v of relArr) maxv = Math.max(maxv, v);
        // axes
        ctx.strokeStyle = "#e6e9ef"; ctx.strokeRect(pad,pad,w,h);
        for (let i=0;i<26;i++){
          const x = pad + i*(barW+gap);
          const val = relArr[i];
          const ph = (val / maxv) * (h*0.9);
          ctx.fillStyle = color;
          ctx.fillRect(x, pad + (h - ph), barW, ph);
          ctx.fillStyle = "#333"; ctx.font = "12px sans-serif";
          ctx.fillText(ALPH[i], x + barW*0.2, pad + h + 14);
        }
        ctx.fillStyle = "#333"; ctx.fillText(title, pad, 16);
      }

      function updatePlainTable(freq){
        freqPlainBody.innerHTML = "";
        for (let i=0;i<26;i++){
          const tr = document.createElement("tr");
          const td1 = document.createElement("td"); td1.textContent = ALPH[i];
          const td2 = document.createElement("td"); td2.textContent = freq.counts[i];
          const td3 = document.createElement("td"); td3.textContent = (freq.rel[i]*100).toFixed(2) + "%";
          tr.append(td1, td2, td3);
          freqPlainBody.appendChild(tr);
        }
      }
      function updateCipherTable(cipherCountByIndex, total){
        freqCipherBody.innerHTML = "";
        for (let i=0;i<26;i++){
          const tr = document.createElement("tr");
          const td1 = document.createElement("td"); td1.textContent = ALPH[i];
          const td2 = document.createElement("td"); td2.textContent = cipherCountByIndex.get(i) || 0;
          const td3 = document.createElement("td"); td3.textContent = (((cipherCountByIndex.get(i)||0)/Math.max(total,1))*100).toFixed(2) + "%";
          tr.append(td1, td2, td3);
          freqCipherBody.appendChild(tr);
        }
      }

      // ===== Handlers =====
      analyzeBtn.addEventListener("click", () => {
        const norm = normalizeText(textInput.value);
        lastPlainNorm = norm;
        const freq = freqFromTextNormalized(norm);
        plainNormSpan.textContent = norm || "(empty)";
        plainNSpan.textContent = freq.total;
        cipherOutput.value = "";
        cipherUnique.textContent = 0;
        guessedPlainTA.value = "";
        guessedPlainTA.placeholder = "Run: Decrypt with frequency analysis";
        truePlainTA.value = "";
        truePlainTA.placeholder = "Run: Decrypt (true, use d)";
        // draw input distribution
        drawSimpleBar(ctxIn, freq.rel, "#4e79a7", "Plaintext frequency (blue)");
        updatePlainTable(freq);
        // clear cipher chart
        const zeros = Array(26).fill(0);
        drawSimpleBar(ctxCi, zeros, "#e15759", "Ciphertext frequency (red) — encrypt to see");
        updateCipherTable(new Map(), 0);
      });

      clearBtn.addEventListener("click", () => { textInput.value = ""; analyzeBtn.click(); });

      // Key generator
      pickPrimesBtn.addEventListener("click", () => {
        const p = randomPrime();
        const q = randomPrime(p);
        const e = [3,5,7,11,13,17,19][Math.floor(Math.random()*7)];
        pField.value = p; qField.value = q; eField.value = e;
        recomputeKey();
      });
      recomputeKeyBtn.addEventListener("click", recomputeKey);

      function recomputeKey(){
        const p = parseInt(pField.value,10);
        const q = parseInt(qField.value,10);
        const e = parseInt(eField.value,10);
        if (!(Number.isInteger(p) && Number.isInteger(q) && Number.isInteger(e))){ alert("p,q,e must be integers"); return; }
        if (p===q){ alert("p and q must be different"); return; }
        const n = p*q;
        const phi = (p-1)*(q-1);
        let d = "(no inverse)";
        try {
          if (gcd(e,phi)!==1) throw new Error("e not coprime with φ(n)");
          d = modInv(e, phi);
        } catch(_) { /* keep "(no inverse)" */ }
        currentKey = {p,q,e,n,phi,d};
        nVal.textContent = n; phiVal.textContent = phi; dVal.textContent = d;
      }

      // Encrypt
      encryptBtn.addEventListener("click", () => {
        if (!currentKey) recomputeKey();
        if (!currentKey) return;
        const norm = normalizeText(textInput.value);
        if (!norm){ alert("Enter plaintext first."); return; }
        const plainNums = Array.from(norm).map(ch => toNum[ch]);
        const cnums = plainNums.map(m => modPow(m, currentKey.e, currentKey.n));
        lastCipherNums = cnums.slice();
        cipherOutput.value = cnums.join(" ");
        plainNormSpan.textContent = norm;
        plainNSpan.textContent = norm.length;
        cipherUnique.textContent = new Set(cnums).size;
        guessedPlainTA.value = "";
        guessedPlainTA.placeholder = "Run: Decrypt with frequency analysis";
        truePlainTA.value = "";
        truePlainTA.placeholder = "Run: Decrypt (true, use d)";
        // distributions
        const plainFreq = freqFromTextNormalized(norm);
        const residuesCount = countsFromArray(cnums);
        const cipherCountByIndex = new Map();
        for (let i=0;i<26;i++){
          const res = modPow(i, currentKey.e, currentKey.n); // residue produced by original letter i
          cipherCountByIndex.set(i, residuesCount.get(res) || 0);
        }
        const cipherRelArr = Array.from({length:26}, (_,i) => (cipherCountByIndex.get(i)||0) / Math.max(cnums.length,1));
        drawSimpleBar(ctxIn, plainFreq.rel, "#4e79a7", "Plaintext frequency (blue)");
        drawSimpleBar(ctxCi, cipherRelArr, "#e15759", "Ciphertext frequency (red)");
        updatePlainTable(plainFreq);
        updateCipherTable(cipherCountByIndex, cnums.length);
      });

      // Decrypt with frequency analysis (using plaintext distribution as reference)
      decryptFreqBtn.addEventListener("click", () => {
        if (!lastCipherNums.length){ alert("Encrypt first."); return; }
        if (!lastPlainNorm){ alert("Analyze plaintext distribution first."); return; }
        const refFreq = freqFromTextNormalized(lastPlainNorm);
        const plainRank = Array.from({length:26}, (_,i)=>({i, c: refFreq.counts[i]})).sort((a,b)=>b.c - a.c).map(x=>x.i);
        const residuesCount = countsFromArray(lastCipherNums);
        const residueRank = Array.from(residuesCount.entries()).map(([r,c])=>({r,c})).sort((a,b)=>b.c - a.c).map(x=>x.r);
        const mapping = new Map();
        for (let i=0;i<residueRank.length;i++){
          mapping.set(residueRank[i], plainRank[i] !== undefined ? plainRank[i] : null);
        }
        const guessed = lastCipherNums.map(c => {
          const idx = mapping.has(c) ? mapping.get(c) : null;
          return (idx===null || idx===undefined) ? "?" : toChar[idx];
        }).join("");
        guessedPlainTA.value = guessed;
      });

      // Decrypt true (use d)
      decryptTrueBtn.addEventListener("click", () => {
        if (!currentKey || currentKey.d === "(no inverse)"){ alert("Key invalid or recompute first."); return; }
        if (!lastCipherNums.length){ alert("Encrypt first."); return; }
        const dec = lastCipherNums.map(c => modPow(c, currentKey.d, currentKey.n));
        const decText = dec.map(n => (n>=0 && n<26) ? toChar[n] : "?").join("");
        truePlainTA.value = decText;
      });

      // initial
      window.addEventListener("load", () => { 
        // precompute key line and input chart
        const evt = new Event('click');
        analyzeBtn.dispatchEvent(evt);
        recomputeKey();
      });
      window.addEventListener("resize", () => { analyzeBtn.click(); });
