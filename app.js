// YardOS v1 (DROP 1) — JSONP-first (CORS-proof) + Admin gate

const YARDOS = {
  API_BASE: "https://script.google.com/macros/s/AKfycbwRXMtWXFH35aPQbjnfeA3gvQXnaSgtTZ4tgMiI5Psc6fAFmwj9-WdYG4L04qf0Rj5J/exec",
  API_KEY: "",

  // Admin PIN is a UI lock (not bank-vault security).
  // For real protection, set Settings!API_KEY and also set YARDOS.API_KEY above.
  ADMIN_PIN: "1234", // <-- change this to your desired PIN
  ADMIN_SESSION_MIN: 120, // how long admin stays unlocked
};

function qs(sel, el=document){ return el.querySelector(sel); }
function qsa(sel, el=document){ return Array.from(el.querySelectorAll(sel)); }

function buildUrl(params = {}) {
  const u = new URL(YARDOS.API_BASE);
  Object.entries(params).forEach(([k,v]) => {
    if (v === undefined || v === null || v === "") return;
    u.searchParams.set(k, String(v));
  });
  if (YARDOS.API_KEY) u.searchParams.set("key", YARDOS.API_KEY);
  return u.toString();
}

// ---------- JSONP (GET) ----------
function apiGet(params){
  return new Promise((resolve, reject) => {
    const cbName = "yardos_cb_" + Math.random().toString(36).slice(2);
    const url = buildUrl({ ...params, callback: cbName });

    const script = document.createElement("script");
    script.src = url;
    script.async = true;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("API timeout (JSONP)."));
    }, 12000);

    function cleanup(){
      clearTimeout(timeout);
      delete window[cbName];
      script.remove();
    }

    window[cbName] = (data) => {
      cleanup();
      if (!data || data.ok !== true) reject(new Error((data && data.error) ? data.error : "API error"));
      else resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("API load error (JSONP)."));
    };

    document.head.appendChild(script);
  });
}

function toast(msg, kind="ok"){
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(()=> t.classList.add("show"), 10);
  setTimeout(()=> { t.classList.remove("show"); setTimeout(()=>t.remove(), 250); }, 2800);
}

function escHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function isSellableStatus(status){
  const s = String(status||"").toUpperCase();
  return ["AVAILABLE","LISTED"].includes(s); // your rule
}

// ---------- Admin Gate ----------
const ADMIN_KEY = "yardos_admin_until";

function adminIsUnlocked(){
  const until = Number(localStorage.getItem(ADMIN_KEY) || "0");
  return Date.now() < until;
}

function adminUnlock(){
  const pin = prompt("Admin PIN:");
  if (pin === null) return false;
  if (String(pin).trim() !== String(YARDOS.ADMIN_PIN)) {
    toast("Wrong PIN.", "bad");
    return false;
  }
  const until = Date.now() + (YARDOS.ADMIN_SESSION_MIN * 60 * 1000);
  localStorage.setItem(ADMIN_KEY, String(until));
  toast("Admin unlocked.");
  return true;
}

function adminLock(){
  localStorage.removeItem(ADMIN_KEY);
  toast("Admin locked.");
}

function requireAdmin(){
  if (adminIsUnlocked()) return true;
  return adminUnlock();
}

// ---------- Config (logo / company name) ----------
async function loadConfig(){
  try{
    const cfg = await apiGet({ action:"getConfig" });
    return cfg;
  }catch(e){
    return { companyName:"Tek-Pak Inc.", logoUrl:"" };
  }
}

function setLogo(imgEl, logoUrl){
  if (!imgEl) return;
  if (logoUrl) imgEl.src = logoUrl;
  else imgEl.style.display = "none";
}
