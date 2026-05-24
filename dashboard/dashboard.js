/* ============================================================
   Dashboard Jóvenes Filadelfia — Lógica de datos y gráficas
   ============================================================

   ⚙️  CONFIGURACIÓN REQUERIDA
   ----------------------------
   1. En tu Apps Script (el mismo que ya tienes), agrega la función
      doGet() que aparece al final de este archivo.
   2. Pega la URL del mismo deployment (/exec) aquí abajo.
   ============================================================ */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxaP86skV9LhmpAyzCtmRXrgvvOoCASdR_HqQ6TQEvl_hKVDkP_Y3cnNHWtvAqH0nJS/exec";

/* ── Mapeos ── */
const OPINION_LABELS  = { 1:"Muy malo", 2:"Malo", 3:"Regular", 4:"Bueno", 5:"Excelente" };
const SABADO_LABELS   = { 1:"Imposible", 2:"Difícil", 3:"Regular", 4:"Bien", 5:"Perfecto" };
const AGE_ORDER       = ["15-17","18-21","22-24","25+"];
const TRASLADO_LABELS = ["No, sin problema","Un poco complicado","Muy difícil"];
const TRASLADO_ICONS  = { "No, sin problema": "🚀", "Un poco complicado": "🛵", "Muy difícil": "🧭" };

/* ── Paleta de colores ── */
const PALETTE = [
  "rgba(124, 58,237,.85)", // purple
  "rgba(236, 72,153,.85)", // pink
  "rgba(  6,182,212,.85)", // cyan
  "rgba( 16,185,129,.85)", // green
  "rgba(245,158, 11,.85)", // amber
  "rgba(239, 68, 68,.85)", // red
];
const PALETTE_BORDER = PALETTE.map(c => c.replace(".85","1"));

/* ── Chart.js defaults ── */
Chart.defaults.color = "#8b8ba7";
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size = 12;

/* ── State ── */
let charts = {};

/* ============================================================
   FETCH DATA
   ============================================================ */
async function loadData() {
  setLoadingState();
  const btn = document.getElementById("btnRefresh");
  btn?.classList.add("spinning");

  try {
    const url = `${SCRIPT_URL}?action=getData&t=${Date.now()}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Error en el script");
    renderDashboard(json.data);
    document.getElementById("lastUpdated").textContent =
      "Actualizado: " + new Date().toLocaleTimeString("es-MX", { hour:"2-digit", minute:"2-digit" });
  } catch (err) {
    console.error("[Dashboard JF]", err);
    showError(err.message);
  } finally {
    btn?.classList.remove("spinning");
  }
}

/* ============================================================
   STATES
   ============================================================ */
function setLoadingState() {
  document.getElementById("loadingState").classList.remove("hidden");
  document.getElementById("errorState").classList.add("hidden");
  document.getElementById("dashboardContent").classList.add("hidden");
}
function showError(msg) {
  document.getElementById("loadingState").classList.add("hidden");
  document.getElementById("errorState").classList.remove("hidden");
  document.getElementById("errorMsg").textContent = msg;
}
function showDashboard() {
  document.getElementById("loadingState").classList.add("hidden");
  document.getElementById("errorState").classList.add("hidden");
  document.getElementById("dashboardContent").classList.remove("hidden");
}

/* ============================================================
   RENDER DASHBOARD
   ============================================================ */
function renderDashboard(rows) {
  if (!rows || rows.length === 0) {
    showError("No hay respuestas registradas todavía.");
    return;
  }
  showDashboard();

  renderKPIs(rows);
  renderHorario(rows);
  renderSabado(rows);
  renderTraslado(rows);
  renderEdades(rows);
  renderEdadSabado(rows);
  renderComentarios(rows);
}

/* ── KPIs ── */
function renderKPIs(rows) {
  const n = rows.length;
  const avgH = avg(rows.map(r => Number(r.opinionHorario)).filter(v => v > 0));
  const avgS = avg(rows.map(r => Number(r.horarioSabado)).filter(v => v > 0));
  const sinProblema = rows.filter(r => r.dificultadTraslado === "No, sin problema").length;

  setText("totalRespuestas", n);
  setText("promedioHorario", avgH ? avgH.toFixed(1) + " / 5" : "—");
  setText("promedioSabado",  avgS ? avgS.toFixed(1) + " / 5" : "—");
  setText("pctSinProblema",  n ? Math.round(sinProblema / n * 100) + "%" : "—");
}

/* ── Horario actual ── */
function renderHorario(rows) {
  const vals = rows.map(r => Number(r.opinionHorario)).filter(v => v >= 1 && v <= 5);
  setText("totalHorario", `${vals.length} respuesta${vals.length !== 1 ? "s" : ""}`);

  const counts = countByKey(vals, [1,2,3,4,5]);
  renderBarChart("chartHorario", {
    labels: Object.values(OPINION_LABELS),
    data: counts,
    color: PALETTE[0],
  });

  // Razones (solo quien dio ≤ 3)
  const razonesRows = rows.filter(r => Number(r.opinionHorario) <= 3 && r.razonHorario);
  const allRazones  = razonesRows.flatMap(r => splitReasons(r.razonHorario));
  if (allRazones.length > 0) {
    const freq = countFreq(allRazones);
    renderHorizontalBar("chartRazonHorario", freq);
    document.getElementById("noRazonHorario").classList.add("hidden");
  } else {
    document.getElementById("chartRazonHorario").closest(".chart-card").querySelector(".chart-wrap").classList.add("hidden");
    document.getElementById("noRazonHorario").classList.remove("hidden");
  }
}

/* ── Sábado ── */
function renderSabado(rows) {
  const vals = rows.map(r => Number(r.horarioSabado)).filter(v => v >= 1 && v <= 5);
  setText("totalSabado", `${vals.length} respuesta${vals.length !== 1 ? "s" : ""}`);

  const counts = countByKey(vals, [1,2,3,4,5]);
  renderBarChart("chartSabado", {
    labels: Object.values(SABADO_LABELS),
    data: counts,
    color: PALETTE[1],
  });

  const razonesRows = rows.filter(r => Number(r.horarioSabado) <= 3 && r.razonSabado);
  const allRazones  = razonesRows.flatMap(r => splitReasons(r.razonSabado));
  if (allRazones.length > 0) {
    const freq = countFreq(allRazones);
    renderHorizontalBar("chartRazonSabado", freq, PALETTE[1]);
    document.getElementById("noRazonSabado").classList.add("hidden");
  } else {
    document.getElementById("chartRazonSabado").closest(".chart-card").querySelector(".chart-wrap").classList.add("hidden");
    document.getElementById("noRazonSabado").classList.remove("hidden");
  }
}

/* ── Traslado ── */
function renderTraslado(rows) {
  const valid = rows.filter(r => r.dificultadTraslado);
  setText("totalTraslado", `${valid.length} respuesta${valid.length !== 1 ? "s" : ""}`);

  // Doughnut
  const freq = countFreq(valid.map(r => r.dificultadTraslado));
  const labels = Object.keys(freq);
  const data   = Object.values(freq);
  renderDoughnutChart("chartTraslado", { labels, data });

  // Stacked bar: traslado por edad
  renderTrasladoEdad(rows);
}

function renderTrasladoEdad(rows) {
  const datasets = TRASLADO_LABELS.map((t, i) => ({
    label: t,
    data: AGE_ORDER.map(age =>
      rows.filter(r => r.edad === age && r.dificultadTraslado === t).length
    ),
    backgroundColor: PALETTE[i],
    borderRadius: 6,
  }));

  destroyChart("chartTrasladoEdad");
  charts["chartTrasladoEdad"] = new Chart(
    document.getElementById("chartTrasladoEdad"), {
    type: "bar",
    data: { labels: AGE_ORDER, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } } },
      scales: {
        x: { stacked: true, grid: { color: "rgba(255,255,255,0.04)" } },
        y: { stacked: true, grid: { color: "rgba(255,255,255,0.04)" }, ticks: { stepSize: 1 } },
      },
    },
  });
}

/* ── Edades ── */
function renderEdades(rows) {
  const valid = rows.filter(r => r.edad);
  setText("totalEdades", `${valid.length} respuesta${valid.length !== 1 ? "s" : ""}`);

  const counts = AGE_ORDER.map(a => valid.filter(r => r.edad === a).length);
  renderDoughnutChart("chartEdad", { labels: AGE_ORDER, data: counts });

  // Promedio horario por edad
  const avgByAge = AGE_ORDER.map(age => {
    const vals = rows
      .filter(r => r.edad === age)
      .map(r => Number(r.opinionHorario))
      .filter(v => v > 0);
    return vals.length ? +(avg(vals).toFixed(2)) : 0;
  });
  destroyChart("chartEdadHorario");
  charts["chartEdadHorario"] = new Chart(
    document.getElementById("chartEdadHorario"), {
    type: "bar",
    data: {
      labels: AGE_ORDER,
      datasets: [{
        label: "Promedio horario actual",
        data: avgByAge,
        backgroundColor: PALETTE[0],
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" } },
        y: { min: 0, max: 5, grid: { color: "rgba(255,255,255,0.04)" },
             ticks: { stepSize: 1 } },
      },
    },
  });
}

/* ── Sábado por edad ── */
function renderEdadSabado(rows) {
  // Promedio de horarioSabado por grupo de edad
  const avgByAge = AGE_ORDER.map(age => {
    const vals = rows
      .filter(r => r.edad === age)
      .map(r => Number(r.horarioSabado))
      .filter(v => v > 0);
    return vals.length ? +(avg(vals).toFixed(2)) : 0;
  });

  destroyChart("chartEdadSabado");
  charts["chartEdadSabado"] = new Chart(
    document.getElementById("chartEdadSabado"), {
    type: "bar",
    data: {
      labels: AGE_ORDER,
      datasets: [{
        label: "Promedio sábado 10 am",
        data: avgByAge,
        backgroundColor: PALETTE[1],
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" } },
        y: { min: 0, max: 5, grid: { color: "rgba(255,255,255,0.04)" },
             ticks: { stepSize: 1, callback: v => ["0","😞","😐","🙂","😊","🤩"][v] || v } },
      },
    },
  });

  // Comparativa: horario actual vs sábado 10 am
  const avgHorarioByAge = AGE_ORDER.map(age => {
    const vals = rows
      .filter(r => r.edad === age)
      .map(r => Number(r.opinionHorario))
      .filter(v => v > 0);
    return vals.length ? +(avg(vals).toFixed(2)) : 0;
  });

  destroyChart("chartEdadComparativa");
  charts["chartEdadComparativa"] = new Chart(
    document.getElementById("chartEdadComparativa"), {
    type: "bar",
    data: {
      labels: AGE_ORDER,
      datasets: [
        {
          label: "Horario actual",
          data: avgHorarioByAge,
          backgroundColor: PALETTE[0],
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: "Sábado 10 am",
          data: avgByAge,
          backgroundColor: PALETTE[1],
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 12, padding: 12 } },
      },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" } },
        y: { min: 0, max: 5, grid: { color: "rgba(255,255,255,0.04)" },
             ticks: { stepSize: 1 } },
      },
    },
  });
}

/* ── Comentarios abiertos ── */
function renderComentarios(rows) {
  const chRow = rows.filter(r => r.razonHorarioDetalle && r.razonHorarioDetalle.trim());
  const csRow = rows.filter(r => r.razonSabadoDetalle  && r.razonSabadoDetalle.trim());

  renderCommentList("comentariosHorario", chRow.map(r => r.razonHorarioDetalle), "noComentariosHorario");
  renderCommentList("comentariosSabado",  csRow.map(r => r.razonSabadoDetalle),  "noComentariosSabado");
}

function renderCommentList(listId, texts, noDataId) {
  const ul = document.getElementById(listId);
  const nd = document.getElementById(noDataId);
  ul.innerHTML = "";
  if (texts.length === 0) {
    nd.classList.remove("hidden");
    return;
  }
  nd.classList.add("hidden");
  texts.forEach((t, i) => {
    const li = document.createElement("li");
    li.className = "comment-item";
    li.style.animationDelay = `${i * 0.05}s`;
    li.textContent = t;
    ul.appendChild(li);
  });
}

/* ============================================================
   CHART HELPERS
   ============================================================ */
function renderBarChart(id, { labels, data, color }) {
  destroyChart(id);
  charts[id] = new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: color || PALETTE[0],
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" } },
        y: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { stepSize: 1 } },
      },
    },
  });
}

function renderHorizontalBar(id, freq, color) {
  const sorted = Object.entries(freq).sort((a,b) => b[1]-a[1]);
  destroyChart(id);
  charts[id] = new Chart(document.getElementById(id), {
    type: "bar",
    data: {
      labels: sorted.map(([k]) => k),
      datasets: [{
        data: sorted.map(([,v]) => v),
        backgroundColor: color || PALETTE[2],
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(255,255,255,0.04)" }, ticks: { stepSize: 1 } },
        y: { grid: { display: false } },
      },
    },
  });
}

function renderDoughnutChart(id, { labels, data }) {
  destroyChart(id);
  charts[id] = new Chart(document.getElementById(id), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: PALETTE,
        borderColor: PALETTE_BORDER,
        borderWidth: 1,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 12, font: { size: 12 } },
        },
      },
      cutout: "62%",
    },
  });
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

/* ============================================================
   UTILS
   ============================================================ */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s,v) => s+v, 0) / arr.length;
}

function countByKey(arr, keys) {
  return keys.map(k => arr.filter(v => v === k).length);
}

function countFreq(arr) {
  return arr.reduce((acc, v) => {
    acc[v] = (acc[v] || 0) + 1;
    return acc;
  }, {});
}

function splitReasons(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  return String(val).split(",").map(s => s.trim()).filter(Boolean);
}

/* ============================================================
   NAV — active link + smooth scroll
   ============================================================ */
function initNav() {
  document.querySelectorAll(".nav-link").forEach(link => {
    link.addEventListener("click", (e) => {
      document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      // Close sidebar on mobile
      document.querySelector(".sidebar")?.classList.remove("open");
    });
  });

  // Observe sections to update active nav
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        document.querySelectorAll(".nav-link").forEach(l => {
          l.classList.toggle("active", l.dataset.section === id);
        });
      }
    });
  }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });

  document.querySelectorAll(".section[id]").forEach(s => observer.observe(s));
}

/* ============================================================
   MOBILE SIDEBAR TOGGLE
   ============================================================ */
function initMobileMenu() {
  const toggle = document.getElementById("menuToggle");
  const sidebar = document.querySelector(".sidebar");
  toggle?.addEventListener("click", () => sidebar?.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (sidebar?.classList.contains("open") &&
        !sidebar.contains(e.target) && e.target !== toggle) {
      sidebar.classList.remove("open");
    }
  });
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initMobileMenu();
  document.getElementById("btnRefresh")?.addEventListener("click", loadData);
  loadData();
});

/* ============================================================
   📋 CÓDIGO PARA APPS SCRIPT — agrega esto al mismo script
   ============================================================

   En tu Apps Script (Extensiones → Apps Script), agrega esta
   función JUNTO a la doPost() que ya tienes:

   function doGet(e) {
     try {
       const action = e && e.parameter && e.parameter.action;
       if (action === "getData") {
         const sheet = SpreadsheetApp
           .getActiveSpreadsheet()
           .getSheetByName("Respuestas");

         const rows = sheet.getDataRange().getValues();
         const headers = rows[0];
         const data = rows.slice(1).map(row => {
           const obj = {};
           headers.forEach((h, i) => { obj[h] = row[i]; });
           return obj;
         });

         return ContentService
           .createTextOutput(JSON.stringify({ ok: true, data }))
           .setMimeType(ContentService.MimeType.JSON);
       }

       // Default: info del script
       return ContentService
         .createTextOutput(JSON.stringify({ ok: true, info: "Encuesta JF API" }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService
         .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }

   ⚠️  IMPORTANTE: Después de agregar doGet(), debes crear
   un NUEVO DEPLOYMENT (no editar el existente). Ve a:
   Deploy → New deployment → Web app → Anyone → Deploy.
   Copia la nueva URL /exec y pégala en SCRIPT_URL arriba.

   ============================================================ */
