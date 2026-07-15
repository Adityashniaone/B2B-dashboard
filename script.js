const NEST_RATIO = 100;

// ---- Data source ----
// Backed by /api/master, a serverless function that reads the B2B Demand
// sheet server-side via a Google service account and returns an array of
// row objects keyed by the sheet's exact header text.
const API_URL = "/api/master";

// Column headers this dashboard understands. Add/adjust aliases here if your
// sheet's header text differs — matching is case/space/punctuation-insensitive.
const FIELD_ALIASES = {
  date: ["date"],
  day: ["day"],
  time: ["time"],
  company: ["company"],
  jco: ["assignedjco", "jco"],
  location: ["locationplantaddress", "location", "plantofficeaddress", "plantaddress", "address"],
  spokesperson: ["spokespersonname", "spokesperson"],
  designation: ["designation"],
  contact: ["contactphoneemail", "contact", "phoneemail", "phone", "email"],
  status: ["status"],
  nextFollowup: ["nextfollowupdate", "nextfollowup"],
  remarks: ["remarks"],
  empStrength: ["estemployeestrength", "employeestrength", "empstrength"],
  meetings: ["noofmeetingsdone", "meetingsdone", "meetings"],
  leads: ["noofleadsreceived", "leadsreceived", "leads"],
  nestsManual: ["approxnestsrequired", "nestsrequired", "nestsreq", "manualnests", "nests"]
};

function normalizeHeader(h){
  return (h || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Maps our internal field names to the sheet's actual header text, e.g.
// { jco: "Assigned JCO", empStrength: "Est. Employee Strength", ... }
function buildFieldMap(headerKeys){
  const map = {};
  Object.entries(FIELD_ALIASES).forEach(([field, aliases])=>{
    const match = headerKeys.find(h => aliases.includes(normalizeHeader(h)));
    if(match !== undefined) map[field] = match;
  });
  return map;
}

function toNumber(v){
  if(v === undefined || v === null || v === "") return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// Sheets API returns dates as the cell's display text (e.g. "11-Jul-26" or
// "7/11/2026"). Normalize whatever comes back into ISO yyyy-mm-dd.
function parseFlexibleDate(str){
  if(!str) return "";
  const s = String(str).trim();

  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);

  let m = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if(m){
    const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const mon = monthNames.indexOf(m[2].slice(0,3).toLowerCase());
    if(mon !== -1){
      const day = m[1].padStart(2,"0");
      let year = m[3];
      if(year.length === 2) year = (parseInt(year,10) < 70 ? "20" : "19") + year;
      return `${year}-${String(mon+1).padStart(2,"0")}-${day}`;
    }
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;

  const d = new Date(s);
  if(!isNaN(d)) return d.toISOString().slice(0,10);

  return s;
}
(function(){
  const trigger = document.getElementById("as-of-trigger");
  const popup = document.getElementById("cal-popup");
  const display = document.getElementById("as-of-display");
  const hiddenInput = document.getElementById("as-of-date");
  let viewDate = new Date();

  function isoToDate(iso){ return iso ? new Date(iso+"T00:00:00") : new Date(); }
  function dateToIso(d){ return d.toISOString().slice(0,10); }
  function fmtDisplay(iso){
    if(!iso) return "All dates";
    const d = isoToDate(iso);
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  }

  function renderCalendar(){
    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const selectedIso = hiddenInput.value;
    const todayIso = new Date().toISOString().slice(0,10);

    let html = `<span class="cal-title">Jump to a date</span>
      <div class="cal-nav">
        <button class="cal-nav-btn" id="cal-prev">&#8249;</button>
        <span class="cal-month-label">${monthNames[month]} ${year}</span>
        <button class="cal-nav-btn" id="cal-next">&#8250;</button>
      </div>
      <div class="cal-weekdays">${["S","M","T","W","T","F","S"].map(d=>`<span>${d}</span>`).join("")}</div>
      <div class="cal-days">`;
    for(let i=0;i<firstDay;i++) html += `<span class="cal-day empty"></span>`;
    for(let day=1; day<=daysInMonth; day++){
      const iso = dateToIso(new Date(year, month, day));
      const cls = ["cal-day"];
      if(iso === selectedIso) cls.push("selected");
      if(iso === todayIso) cls.push("today");
      html += `<button class="${cls.join(" ")}" data-date="${iso}">${day}</button>`;
    }
    html += `</div>
      <div class="cal-footer">
        <button class="cal-link" id="cal-clear">Clear</button>
        <button class="cal-link" id="cal-today">Today</button>
      </div>`;
    popup.innerHTML = html;

    document.getElementById("cal-prev").onclick = ()=>{ viewDate.setMonth(viewDate.getMonth()-1); renderCalendar(); };
    document.getElementById("cal-next").onclick = ()=>{ viewDate.setMonth(viewDate.getMonth()+1); renderCalendar(); };
    document.getElementById("cal-today").onclick = ()=> selectDate(new Date().toISOString().slice(0,10));
    document.getElementById("cal-clear").onclick = ()=> selectDate("");
    popup.querySelectorAll(".cal-day:not(.empty)").forEach(btn=>{
      btn.onclick = ()=> selectDate(btn.dataset.date);
    });
  }

  function selectDate(iso){
    hiddenInput.value = iso;
    display.textContent = fmtDisplay(iso);
    popup.classList.remove("open");
    if(iso) viewDate = isoToDate(iso);
    onAsOfChange();
  }

  trigger.addEventListener("click", (e)=>{
    e.stopPropagation();
    viewDate = isoToDate(hiddenInput.value || new Date().toISOString().slice(0,10));
    renderCalendar();
    popup.classList.toggle("open");
  });
  document.addEventListener("click", (e)=>{
    if(!popup.contains(e.target) && !trigger.contains(e.target)) popup.classList.remove("open");
  });

  window.refreshAsOfDisplay = function(){ display.textContent = fmtDisplay(hiddenInput.value); };
})();

async function loadSheet(){
  const res = await fetch(API_URL);
  let json;
  try{
    json = await res.json();
  }catch(e){
    throw new Error(`${API_URL} did not return valid JSON (status ${res.status}).`);
  }
  if(!res.ok){
    throw new Error(json && json.error ? json.error : `${API_URL} returned status ${res.status}.`);
  }
  return json;
}

function rowsFromSheetJson(json){
  if(!Array.isArray(json)) throw new Error(`Unexpected response from ${API_URL} — expected an array of rows.`);
  if(json.length === 0) return [];

  const fieldMap = buildFieldMap(Object.keys(json[0]));

  const rows = json.map(rowObj=>{
    const get = (field) => fieldMap[field] !== undefined ? rowObj[fieldMap[field]] : undefined;

    return {
      date: parseFlexibleDate(get("date")),
      day: (get("day") || "").toString().trim(),
      time: (get("time") || "").toString().trim(),
      company: (get("company") || "").toString().trim(),
      jco: (get("jco") || "").toString().trim(),
      location: (get("location") || "").toString().trim(),
      spokesperson: (get("spokesperson") || "").toString().trim(),
      designation: (get("designation") || "").toString().trim(),
      contact: (get("contact") || "").toString().trim(),
      status: (get("status") || "").toString().trim() || "Pending",
      nextFollowup: (get("nextFollowup") || "").toString().trim(),
      remarks: (get("remarks") || "").toString().trim(),
      empStrength: toNumber(get("empStrength")),
      meetings: toNumber(get("meetings")),
      leads: toNumber(get("leads")),
      nestsManual: (()=>{
        const raw = get("nestsManual");
        if(raw === undefined || raw === null || String(raw).trim() === "") return null;
        return toNumber(raw);
      })()
    };
  }).filter(r => r.company);

  return rows;
}

function fmtDate(iso){
  if(!iso) return "";
  const d = new Date(iso+"T00:00:00");
  if(isNaN(d)) return iso;
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2,"0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
}
function monthKey(iso){
  const d = new Date(iso+"T00:00:00");
  if(isNaN(d)) return "";
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  return months[d.getMonth()]+" "+d.getFullYear();
}
function statusClass(s){
  const v = (s||"").toLowerCase();
  if(v==="completed") return "completed";
  if(v==="scheduled") return "scheduled";
  if(v.includes("follow")) return "followup";
  return "pending";
}
function uniqueSorted(arr){ return [...new Set(arr.filter(Boolean))].sort(); }

function populateSelect(id, values){
  const sel = document.getElementById(id);
  sel.querySelectorAll("option:not(:first-child)").forEach(o=>o.remove());
  values.forEach(v=>{
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    sel.appendChild(opt);
  });
}

let DATA = [];
let locationFilterOverride = "";

function getFiltered(){
  const location = locationFilterOverride || document.getElementById("f-location").value;
  const company = document.getElementById("f-company").value;
  const jco = document.getElementById("f-jco").value;
  const status = document.getElementById("f-status").value;
  const month = document.getElementById("f-month").value;
  const search = document.getElementById("f-search").value.trim().toLowerCase();
  const asOf = document.getElementById("as-of-date").value;

  return DATA.filter(d=>{
    if(location && d.location!==location) return false;
    if(company && d.company!==company) return false;
    if(jco && d.jco!==jco) return false;
    if(status && d.status!==status) return false;
    if(month && monthKey(d.date)!==month) return false;
    if(search && !(d.company.toLowerCase().includes(search) || d.spokesperson.toLowerCase().includes(search))) return false;
    if(asOf && d.date && d.date > asOf) return false;
    return true;
  });
}

// Called by the calendar popup whenever the "Visits Till Date" value changes.
function onAsOfChange(){
  render();
}

function companyMetrics(rows){
  const byCompany = new Map();
  rows.forEach(r=>{
    if(!byCompany.has(r.company)) byCompany.set(r.company, {empStrength: r.empStrength, nestsManual: r.nestsManual});
  });
  const companiesVisited = byCompany.size;
  let empStrength = 0, nests = 0;
  byCompany.forEach(v=>{
    empStrength += v.empStrength;
    nests += (v.nestsManual !== null && v.nestsManual > 0) ? v.nestsManual : Math.ceil(v.empStrength/NEST_RATIO);
  });
  return {companiesVisited, empStrength, nests};
}
function visitMetrics(rows){
  const meetings = rows.reduce((s,r)=>s+r.meetings,0);
  const leads = rows.reduce((s,r)=>s+r.leads,0);
  return {meetings, leads, visits: rows.length};
}

function render(){
  const rows = getFiltered();
  const cm = companyMetrics(rows);
  const vm = visitMetrics(rows);

  document.getElementById("kpiCompanies").textContent = cm.companiesVisited;
  document.getElementById("kpiEmpStrength").textContent = cm.empStrength.toLocaleString("en-IN");
  document.getElementById("kpiMeetings").textContent = vm.meetings;
  document.getElementById("kpiMeetingsFoot").textContent = `across ${vm.visits} visit${vm.visits!==1?"s":""}`;
  document.getElementById("kpiLeads").textContent = vm.leads;
  document.getElementById("kpiLeadsFoot").textContent = vm.meetings ? `${Math.round(vm.leads/vm.meetings*100)}% of meetings converted` : "0% of meetings converted";
  document.getElementById("kpiNests").textContent = cm.nests;

  const jcoTbody = document.getElementById("jcoTableBody");
  jcoTbody.innerHTML = "";
  const jcos = uniqueSorted(rows.map(r=>r.jco));
  document.getElementById("jcoCountPill").textContent = `${jcos.length} JCO${jcos.length!==1?"s":""}`;

  jcos.forEach(jco=>{
    const jcoRows = rows.filter(r=>r.jco===jco);
    const jcm = companyMetrics(jcoRows);
    const jvm = visitMetrics(jcoRows);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${jco}</td>
      <td class="num">${jcm.companiesVisited}</td>
      <td class="num">${jcm.empStrength.toLocaleString("en-IN")}</td>
      <td class="num">${jvm.meetings}</td>
      <td class="num">${jvm.leads}</td>
      <td class="num">${jcm.nests}</td>
    `;
    jcoTbody.appendChild(tr);
  });

  if(jcos.length){
    const totalRow = document.createElement("tr");
    totalRow.className = "total-row";
    totalRow.innerHTML = `
      <td>Total (all JCOs)</td>
      <td class="num">${cm.companiesVisited}</td>
      <td class="num">${cm.empStrength.toLocaleString("en-IN")}</td>
      <td class="num">${vm.meetings}</td>
      <td class="num">${vm.leads}</td>
      <td class="num">${cm.nests}</td>
    `;
    jcoTbody.appendChild(totalRow);
  }

  document.getElementById("visitCountPill").textContent = `${rows.length} visit${rows.length!==1?"s":""}`;
  const tbody = document.getElementById("visitTableBody");
  tbody.innerHTML = "";
  document.getElementById("emptyState").style.display = rows.length ? "none" : "block";

  rows
    .slice()
    .sort((a,b)=> a.date < b.date ? 1 : -1)
    .forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="company">${r.company}</div>
          <div class="sub">${fmtDate(r.date)}${r.day ? " ("+r.day+")" : ""}</div>
        </td>
        <td>${r.location || "—"}</td>
        <td>${r.jco || "—"}</td>
        <td class="num">${r.meetings}</td>
        <td class="num">${r.leads}</td>
        <td><span class="status ${statusClass(r.status)}">${r.status}</span></td>
      `;
      tbody.appendChild(tr);
    });

  renderLocationPanel(rows);
}

function renderLocationPanel(rows){
  const list = document.getElementById("locationList");
  list.innerHTML = "";

  const byLocation = {};
  rows.forEach(r=>{
    const key = r.location || "Unspecified";
    byLocation[key] = byLocation[key] || {count:0, companies:new Set()};
    byLocation[key].count++;
    byLocation[key].companies.add(r.company);
  });

  const total = rows.length || 1;
  const entries = Object.entries(byLocation).sort((a,b)=>b[1].count-a[1].count);

  if(entries.length===0){
    list.innerHTML = '<div class="empty">No data for current filters.</div>';
    return;
  }

  const maxCount = Math.max(...entries.map(e=>e[1].count));

  entries.forEach(([location, info])=>{
    const pct = Math.round(info.count/total*100);
    const barPct = Math.round(info.count/maxCount*100);
    const row = document.createElement("div");
    row.className = "t-row";
    row.innerHTML = `
      <div class="t-top">
        <div>
          <div class="t-name">${location}</div>
          <div class="t-meta">${info.companies.size} compan${info.companies.size!==1?"ies":"y"}</div>
        </div>
        <div style="text-align:right;">
          <div class="t-count">${info.count}</div>
          <div class="t-pct">${pct}%</div>
        </div>
      </div>
      <div class="bar-bg"><div class="bar-fill" style="width:${barPct}%;"></div></div>
    `;
    row.addEventListener("click", ()=>{
      document.getElementById("f-location").value = location;
      locationFilterOverride = "";
      render();
    });
    list.appendChild(row);
  });
}

function bindFilterEvents(){
  ["f-location","f-company","f-jco","f-status","f-month"].forEach(id=>{
    document.getElementById(id).addEventListener("change", ()=>{ locationFilterOverride=""; render(); });
  });
  document.getElementById("f-search").addEventListener("input", render);

  document.getElementById("resetBtn").addEventListener("click", ()=>{
    ["f-location","f-company","f-jco","f-status","f-month"].forEach(id=>{
      document.getElementById(id).value = "";
    });
    document.getElementById("f-search").value = "";
    document.getElementById("as-of-date").value = "";
    if(window.refreshAsOfDisplay) window.refreshAsOfDisplay();
    locationFilterOverride = "";
    render();
  });
  document.getElementById("refreshBtn").addEventListener("click", refreshFromSheet);
}

function setStatus(msg, type){
  const el = document.getElementById("sheetStatus");
  el.textContent = msg;
  el.className = "sheet-status" + (type ? " " + type : "");
}

async function refreshFromSheet(){
  setStatus("Loading data from /api/master...", "");
  try{
    const json = await loadSheet();
    DATA = rowsFromSheetJson(json);

    populateSelect("f-location", uniqueSorted(DATA.map(d=>d.location)));
    populateSelect("f-company", uniqueSorted(DATA.map(d=>d.company)));
    populateSelect("f-jco", uniqueSorted(DATA.map(d=>d.jco)));
    populateSelect("f-status", uniqueSorted(DATA.map(d=>d.status)));
    populateSelect("f-month", uniqueSorted(DATA.map(d=>monthKey(d.date))));

    const asOfInput = document.getElementById("as-of-date");
    if(!asOfInput.value){
      asOfInput.value = new Date().toISOString().slice(0,10);
    }
    if(window.refreshAsOfDisplay) window.refreshAsOfDisplay();

    setStatus(`Loaded ${DATA.length} visit${DATA.length!==1?"s":""} from the sheet.`, "ok");
    render();
  }catch(err){
    setStatus(err.message || "Could not load the sheet.", "error");
  }
}

bindFilterEvents();
refreshFromSheet();
