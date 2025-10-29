 // ======= Seedable RNG (Mulberry32) =======
    function mulberry32(a){ return function(){ let t = a += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    function strHash(s){ let h=2166136261>>>0; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

    // ======= DOM =======
    const mIn = document.getElementById('m-input');
    const nIn = document.getElementById('n-input');
    const pIn = document.getElementById('p-input');
    const seedIn = document.getElementById('seed-input');

    const runBtn = document.getElementById('run-btn');
    const clearBtn = document.getElementById('clear-btn');

    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    const speedIn = document.getElementById('speed-input');
    const tIn = document.getElementById('t-input');
    const tLabel = document.getElementById('t-label');
    const nLabel = document.getElementById('n-label');
    const bandToggle = document.getElementById('band-toggle');

    const trajCanvas = document.getElementById('traj-canvas');
    const histCanvas = document.getElementById('hist-canvas');
    const trajCtx = trajCanvas.getContext('2d');
    const histCtx = histCanvas.getContext('2d');

    const meanOut = document.getElementById('mean-fn');
    const sdOut = document.getElementById('sd-fn');
    const mOut = document.getElementById('m-out');
    const nOut = document.getElementById('n-out');

    // ======= State =======
    let paths = [];        // paths[j][t-1] = f_t for trajectory j
    let meanPath = [];     // meanPath[t-1]
    let fnValues = [];     // current f_t across trajectories
    let m=150, n=1000, p=0.5;
    let rng = Math.random;
    let animReq = 0;
    let currentT = 1;

    // ======= Helpers =======
    function resizeCanvas(c){ c.width = c.clientWidth; c.height = c.clientHeight; }

    function gridAxes(ctx, yTicks=[0,0.25,0.5,0.75,1], xTicks=null, pad=44){
      const w = ctx.canvas.width - pad*2, h = ctx.canvas.height - pad*2;
      ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
      ctx.lineCap = 'round';
      // frame
      ctx.strokeStyle = '#e6e9ef'; ctx.lineWidth = 1; ctx.strokeRect(pad,pad,w,h);
      // grid Y
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.fillStyle = '#374151';
      ctx.strokeStyle = '#eef2f7';
      ctx.lineWidth = 1;
      for (const y of yTicks){
        const yy = pad + h - y*h;
        ctx.beginPath(); ctx.moveTo(pad,yy); ctx.lineTo(pad+w,yy); ctx.stroke();
        ctx.fillText(y.toFixed(2), pad-36, yy+4);
      }
      // grid X (if provided)
      if (xTicks){
        for (const [label, t] of xTicks){
          const xx = pad + (t/(n-1))*w;
          ctx.beginPath(); ctx.moveTo(xx,pad); ctx.lineTo(xx,pad+h); ctx.stroke();
          ctx.fillText(label, xx-8, pad+h+16);
        }
      }
      return {pad,w,h};
    }

    function roundRect(ctx,x,y,w,h,r){
      const rr = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+rr,y);
      ctx.arcTo(x+w,y,x+w,y+h,rr);
      ctx.arcTo(x+w,y+h,x,y+h,rr);
      ctx.arcTo(x,y+h,x,y,rr);
      ctx.arcTo(x,y,x+w,y,rr);
      ctx.closePath();
    }

    function drawTrajectoriesAtT(t){
      resizeCanvas(trajCanvas);
      const xTicks = [['0',0], [String(Math.floor((n-1)/4)), Math.floor((n-1)/4)], [String(Math.floor((n-1)/2)), Math.floor((n-1)/2)], [String(n-1), n-1]];
      const {pad,w,h} = gridAxes(trajCtx, [0,0.25,0.5,0.75,1], xTicks);

      const ypix = v => pad + h - v*h;
      const xpix = k => pad + (k / (n-1)) * w;

      // band around p (optional: ± 1/sqrt(t))
      if (bandToggle.checked){
        const sigma = Math.sqrt(p*(1-p)/Math.max(1,t)); // ~ sd of ft at current t
        const yTop = Math.min(1, p + 2*sigma), yBot = Math.max(0, p - 2*sigma);
        trajCtx.fillStyle = 'rgba(16,185,129,0.10)'; // green-ish translucent
        trajCtx.fillRect(pad, ypix(yTop), w, Math.max(1, ypix(yBot)-ypix(yTop)));
      }

      // p reference
      trajCtx.strokeStyle = '#ef4444'; trajCtx.lineWidth = 1.5;
      trajCtx.beginPath(); trajCtx.moveTo(pad, ypix(p)); trajCtx.lineTo(pad+w, ypix(p)); trajCtx.stroke();

      // trajectories (draw only up to t)
      trajCtx.strokeStyle = '#94a3b8'; trajCtx.lineWidth = 1; trajCtx.globalAlpha = 0.55;
      for (const path of paths){
        trajCtx.beginPath();
        trajCtx.moveTo(xpix(0), ypix(path[0]));
        for (let k=1;k<t;k++){ trajCtx.lineTo(xpix(k), ypix(path[k])); }
        trajCtx.stroke();
      }
      trajCtx.globalAlpha = 1;

      // mean path up to t
      trajCtx.strokeStyle = '#16a34a'; trajCtx.lineWidth = 2.2;
      trajCtx.beginPath();
      trajCtx.moveTo(xpix(0), ypix(meanPath[0]));
      for (let k=1;k<t;k++){ trajCtx.lineTo(xpix(k), ypix(meanPath[k])); }
      trajCtx.stroke();
    }

    function drawHistogram(values, pRef){
      resizeCanvas(histCanvas);
      const {pad,w,h} = gridAxes(histCtx, [0,0.25,0.5,0.75,1], null);

      // bins
      const bins = 24;
      const min=0, max=1;
      const bw = w/bins;
      const counts = new Array(bins).fill(0);
      for (const v of values){
        let b = Math.floor((v-min)/(max-min)*bins);
        if (b<0) b=0; if (b>=bins) b=bins-1;
        counts[b]++;
      }
      const maxC = Math.max(1, ...counts);

      // bars rounded
      for (let i=0;i<bins;i++){
        const x = pad + i*bw + 2;
        const hh = (counts[i]/maxC) * (h*0.95);
        const y = pad + h - hh;
        histCtx.fillStyle = '#e15759';
        roundRect(histCtx, x, y, Math.max(1, bw - 4), Math.max(2, hh), 4);
        histCtx.fill();
      }

      // vertical reference at p
      const px = pad + (pRef - min) / (max - min) * w;
      histCtx.strokeStyle = '#ef4444'; histCtx.lineWidth = 1.5;
      histCtx.beginPath(); histCtx.moveTo(px, pad); histCtx.lineTo(px, pad+h); histCtx.stroke();
    }

    function mean(arr){ return arr.reduce((a,b)=>a+b,0)/Math.max(1,arr.length); }
    function sd(arr){ const mu = mean(arr); const v = mean(arr.map(x => (x-mu)*(x-mu))); return Math.sqrt(v); }

    // ======= Simulation =======
    function simulateAll(){
      // read params
      m = Math.max(1, parseInt(mIn.value,10) || 0);
      n = Math.max(2, parseInt(nIn.value,10) || 0);
      p = Math.min(1, Math.max(0, parseFloat(pIn.value)));
      const seedTxt = (seedIn.value||'').trim();
      rng = seedTxt ? mulberry32(strHash(seedTxt)) : Math.random;

      // paths
      paths = new Array(m);
      meanPath = new Array(n).fill(0);
      for (let j=0;j<m;j++){
        let s=0;
        const path = new Array(n);
        for (let t=1;t<=n;t++){
          s += (rng() < p) ? 1 : 0;
          const ft = s / t;
          path[t-1] = ft;
          meanPath[t-1] += ft;
        }
        paths[j] = path;
      }
      for (let t=0;t<n;t++) meanPath[t] /= m;

      // reset time & UI
      currentT = 1;
      tIn.max = n; tIn.value = currentT;
      tLabel.textContent = String(currentT);
      nLabel.textContent = String(n);

      // draw first frame
      fnValues = paths.map(path => path[currentT-1]);
      drawTrajectoriesAtT(currentT);
      drawHistogram(fnValues, p);
      updateStats();
    }

    function updateStats(){
      meanOut.textContent = mean(fnValues).toFixed(4);
      sdOut.textContent = sd(fnValues).toFixed(4);
      mOut.textContent = m;
      nOut.textContent = n;
    }

    function stepForward(steps){
      currentT = Math.min(n, currentT + steps);
      tIn.value = currentT;
      tLabel.textContent = String(currentT);
      fnValues = paths.map(path => path[currentT-1]);
      drawTrajectoriesAtT(currentT);
      drawHistogram(fnValues, p);
      updateStats();
    }

    function animate(){
      const speed = Math.max(1, parseInt(speedIn.value,10) || 1);
      stepForward(speed);
      if (currentT < n){
        animReq = requestAnimationFrame(animate);
      } else {
        animReq = 0;
      }
    }

    // ======= Events =======
    runBtn.addEventListener('click', simulateAll);
    clearBtn.addEventListener('click', () => {
      paths = []; meanPath = []; fnValues = [];
      trajCtx.clearRect(0,0,trajCanvas.width,trajCanvas.height);
      histCtx.clearRect(0,0,histCanvas.width,histCanvas.height);
      meanOut.textContent = sdOut.textContent = mOut.textContent = nOut.textContent = '-';
    });

    playBtn.addEventListener('click', () => {
      if (!paths.length) simulateAll();
      if (!animReq && currentT < n) animReq = requestAnimationFrame(animate);
    });

    pauseBtn.addEventListener('click', () => {
      if (animReq) { cancelAnimationFrame(animReq); animReq = 0; }
    });

    resetBtn.addEventListener('click', () => {
      if (animReq) { cancelAnimationFrame(animReq); animReq = 0; }
      currentT = 1;
      if (!paths.length) simulateAll();
      tIn.value = currentT; tLabel.textContent = String(currentT);
      fnValues = paths.map(path => path[currentT-1]);
      drawTrajectoriesAtT(currentT);
      drawHistogram(fnValues, p);
      updateStats();
    });

    tIn.addEventListener('input', () => {
      if (!paths.length) return;
      if (animReq) { cancelAnimationFrame(animReq); animReq = 0; }
      currentT = Math.min(n, Math.max(1, parseInt(tIn.value,10)||1));
      tLabel.textContent = String(currentT);
      fnValues = paths.map(path => path[currentT-1]);
      drawTrajectoriesAtT(currentT);
      drawHistogram(fnValues, p);
      updateStats();
    });

    bandToggle.addEventListener('change', () => {
      if (!paths.length) return;
      drawTrajectoriesAtT(currentT);
    });

    // First render
    window.addEventListener('load', simulateAll);
    window.addEventListener('resize', () => { if (paths.length){ drawTrajectoriesAtT(currentT); drawHistogram(fnValues, p); } });