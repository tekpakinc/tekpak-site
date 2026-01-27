
// YardOS v0.1 — shared helpers
const YARDOS = {
  API_BASE: "https://script.google.com/macros/s/AKfycbwRXMtWXFH35aPQbjnfeA3gvQXnaSgtTZ4tgMiI5Psc6fAFmwj9-WdYG4L04qf0Rj5J/exec",
  API_KEY: "", // optional: set if you added API_KEY in Settings tab
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
  // JSONP not needed for modern fetch since GAS returns CORS-friendly responses for webapp
  return u.toString();
}

async function apiGet(params) {
  const url = buildUrl(params);
  const res = await fetch(url, { method: "GET" });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch(e) { throw new Error(`API parse error. Response: ${txt.slice(0,300)}`); }
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
}

async function apiPost(action, payload, extraParams={}) {
  // POST to GAS often works, but sometimes CORS can be picky depending on deployment.
  // We'll use GET with payload as a fallback if needed later.
  const url = buildUrl({ action, ...extraParams });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  let data;
  try { data = JSON.parse(txt); }
  catch(e) { throw new Error(`API parse error. Response: ${txt.slice(0,300)}`); }
  if (!data.ok) throw new Error(data.error || "API error");
  return data;
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
  // Your rule: LISTED = available
  return ["AVAILABLE","LISTED"].includes(s);
}

function prettyJson(obj){
  return JSON.stringify(obj, null, 2);
}
