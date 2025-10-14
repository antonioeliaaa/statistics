// ===== Config DB (IndexedDB) =====
const DB_NAME = "socLogs";
const DB_VERSION = 1;
const STORE = "events";
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const store = d.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("user_id", "user_id");
        store.createIndex("timestamp", "timestamp");
        store.createIndex("action", "action");
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror   = () => reject(req.error);
  });
}

function txStore(mode = "readonly") {
  const tx = db.transaction(STORE, mode);
  return tx.objectStore(STORE);
}

function addEvent(ev) {
  return new Promise((resolve, reject) => {
    const req = txStore("readwrite").add(ev);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function getAll() {
  return new Promise((resolve, reject) => {
    const req = txStore("readonly").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

function clearAll() {
  return new Promise((resolve, reject) => {
    const req = txStore("readwrite").clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ===== Helpers UI =====
const seedBtn   = document.getElementById("seedBtn");
const clearBtn  = document.getElementById("clearBtn");
const addBtn    = document.getElementById("addBtn");
const eventsWrap = document.getElementById("eventsWrap");
const distTable  = document.getElementById("distTable");
const distInfo   = document.getElementById("distInfo");
const dbStatus   = document.getElementById("dbStatus");

const fUser   = document.getElementById("fUser");
const fTime   = document.getElementById("fTime");
const fAction = document.getElementById("fAction");

function fmtDateOnly(ts) {
  try { return new Date(ts).toISOString().slice(0,10); }
  catch { return "invalid"; }
}

function renderEventsTable(rows) {
  if (!rows.length) {
    eventsWrap.textContent = "Nessun evento.";
    return;
  }
  const thead = `<thead><tr><th>#</th><th>user_id</th><th>timestamp</th><th>action</th></tr></thead>`;
  const body = rows.map(r =>
    `<tr><td>${r.id ?? ""}</td><td>${r.user_id}</td><td>${r.timestamp}</td><td>${r.action}</td></tr>`
  ).join("");
  eventsWrap.innerHTML = `<table>${thead}<tbody>${body}</tbody></table>`;
}

function renderDistributionTable(title, freqMap) {
  const entries = Object.entries(freqMap).sort((a,b)=>b[1]-a[1]);
  distInfo.textContent = title;
  if (!entries.length) {
    distTable.innerHTML = "<em>Nessun dato.</em>";
    return;
  }
  const thead = `<thead><tr><th>Valore</th><th>Frequenza</th></tr></thead>`;
  const rows = entries.map(([k,v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
  distTable.innerHTML = `<table>${thead}<tbody>${rows}</tbody></table>`;
}

// ===== Distribuzioni =====
async function distributionBy(field) {
  const rows = await getAll();
  const freq = {};
  for (const r of rows) {
    let key = (field === "date") ? fmtDateOnly(r.timestamp) : r[field];
    if (key == null) key = "null";
    freq[key] = (freq[key] || 0) + 1;
  }
  const label = (field === "date")
    ? "Distribuzione per data (YYYY-MM-DD)"
    : `Distribuzione per ${field}`;
  renderDistributionTable(label, freq);
}

// ===== Seed di esempio =====
const seedData = [
  { user_id:"U1023", timestamp:"2025-10-13T08:45:12Z", action:"login_success" },
  { user_id:"U0876", timestamp:"2025-10-13T08:46:01Z", action:"login_failed" },
  { user_id:"U1023", timestamp:"2025-10-13T08:50:45Z", action:"password_reset" },
  { user_id:"U0451", timestamp:"2025-10-13T09:01:33Z", action:"login_success" },
  { user_id:"U0876", timestamp:"2025-10-13T09:05:20Z", action:"login_failed" },
  { user_id:"U0876", timestamp:"2025-10-13T09:07:55Z", action:"login_failed" },
  { user_id:"U0876", timestamp:"2025-10-13T09:09:42Z", action:"login_success" }
];

// ===== Event wiring =====
document.querySelectorAll(".groupBtn").forEach(btn => {
  btn.addEventListener("click", () => distributionBy(btn.dataset.group));
});

seedBtn?.addEventListener("click", async () => {
  for (const row of seedData) await addEvent(row);
  renderEventsTable(await getAll());
});

clearBtn?.addEventListener("click", async () => {
  await clearAll();
  renderEventsTable([]);
  renderDistributionTable("Distribuzione", {});
});

addBtn?.addEventListener("click", async () => {
  const user = (fUser.value || "").trim();
  if (!user) return;
  const ts = (fTime.value || "").trim() || new Date().toISOString();
  await addEvent({ user_id: user, timestamp: ts, action: fAction.value });
  renderEventsTable(await getAll());
  fUser.value = ""; // reset
});

// ===== Init =====
(async function init(){
  await openDB();
  dbStatus && (dbStatus.textContent = "DB: online");
  renderEventsTable(await getAll());
})();
