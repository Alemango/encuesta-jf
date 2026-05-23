/* ============================================================
   Encuesta Jóvenes Filadelfia — Lógica del formulario
   ============================================================ */

/* ============================================================
   CONFIGURACIÓN — INTEGRACIÓN GOOGLE SHEETS (DIFERIDA)
   ------------------------------------------------------------
   Cuando el liderazgo decida la versión final, pegar aquí
   la URL del Google Apps Script desplegado como Web App y
   descomentar el bloque "fetch" dentro de handleSubmit().

   --- PASOS PARA HABILITAR EL ENVÍO A GOOGLE SHEETS ---

   1) Crear un Google Sheet vacío con esta cabecera en la fila 1:
      timestamp | version | nombre | edad | opinionHorario |
      razonHorario | razonHorarioDetalle | horarioSabado |
      razonSabado | razonSabadoDetalle | frecuenciaAsistencia |
      dificultadTraslado | atractivoReuniones | atractivoOtroDetalle

   2) Extensiones → Apps Script → pegar:

      function doPost(e) {
        try {
          const data = JSON.parse(e.postData.contents);
          const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
          sheet.appendRow([
            data.timestamp,
            data.version,
            data.nombre || "",
            data.edad || "",
            data.opinionHorario || "",
            (data.razonHorario || []).join(", "),
            data.razonHorarioDetalle || "",
            data.horarioSabado || "",
            (data.razonSabado || []).join(", "),
            data.razonSabadoDetalle || "",
            data.frecuenciaAsistencia || "",
            data.dificultadTraslado || "",
            (data.atractivoReuniones || []).join(", "),
            data.atractivoOtroDetalle || "",
          ]);
          return ContentService
            .createTextOutput(JSON.stringify({ ok: true }))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (err) {
          return ContentService
            .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

   3) Deploy → New deployment → Web app
        - Execute as: Me
        - Who has access: Anyone
      Copiar la URL terminada en "/exec".

   4) Pegar esa URL en GOOGLE_SCRIPT_URL abajo.
   5) Descomentar el bloque "fetch" dentro de handleSubmit().
   ============================================================ */
const GOOGLE_SCRIPT_URL = "TU_URL_AQUÍ";

const STORAGE_KEY = "jf_encuesta_enviada_v1";

/* ============================================================
   Helpers
   ============================================================ */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* ============================================================
   1) Edad — radios ocultos + labels estilizados como chips
   ------------------------------------------------------------
   Los 4 rangos (15-17, 18-21, 22-24, 25+) están en index.html
   como <input type="radio"> reales para que la validación
   HTML5 (required) funcione nativamente.
   ============================================================ */

/* ============================================================
   2) Selector de versión
   ============================================================ */
function setupVersionSwitcher() {
  const pills = $$(".version-pill");
  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const v = pill.dataset.setVersion;
      document.body.setAttribute("data-version", v);
      pills.forEach((p) => p.classList.toggle("is-active", p === pill));
      updateRequiredFields();
    });
  });
}

/* ============================================================
   3) Required dinámico según versión activa
   ------------------------------------------------------------
   Marcamos required en los inputs visibles según data-version.
   - data-required="true": siempre requerido en cualquier versión
   - data-required-v2="true": requerido solo cuando hay V2 activa
   ============================================================ */
function updateRequiredFields() {
  const version = document.body.dataset.version;

  // Campos base (siempre requeridos)
  $$('[data-required="true"]').forEach((el) => el.required = true);

  // Campos V2
  const isV2 = version === "v2";
  $$('[data-required-v2="true"]').forEach((el) => el.required = isV2);
}

/* ============================================================
   4) Pregunta condicional: razón del horario
   ============================================================ */
function setupCondicional(inputName, conditionalId, checkboxName, detalleId) {
  const ratings = $$(`input[name="${inputName}"]`);
  const conditional = $(`#${conditionalId}`);
  if (!conditional) return;

  ratings.forEach((r) => {
    r.addEventListener("change", () => {
      const v = Number(r.value);
      r.closest(".field")?.classList.remove("has-error");
      if (v <= 3) {
        conditional.classList.add("is-open");
        conditional.setAttribute("aria-hidden", "false");
      } else {
        conditional.classList.remove("is-open");
        conditional.setAttribute("aria-hidden", "true");
        // Limpiar valores si se oculta
        $$(`input[name="${checkboxName}"]`).forEach((c) => c.checked = false);
        const detalle = $(`#${detalleId}`);
        if (detalle) detalle.value = "";
      }
    });
  });
}

function setupCondicionalHorario() {
  setupCondicional("opinionHorario", "razonHorario", "razonHorario", "razonHorarioDetalle");
}

function setupCondicionalSabado() {
  setupCondicional("horarioSabado", "razonSabado", "razonSabado", "razonSabadoDetalle");
}

/* ============================================================
   5) Validación personalizada (radios y chip de edad)
   ------------------------------------------------------------
   HTML5 valida los inputs nativos. Para los grupos custom
   (edad como chips) hacemos validación manual y resaltamos
   el field con .has-error.
   ============================================================ */
function marcarErroresVisuales(form) {
  // Highlight visual de fields con radios required sin selección.
  // La validación bloqueante la hace HTML5 nativo (reportValidity).
  $$(".field").forEach((f) => {
    const radios = $$('input[type="radio"]', f);
    if (radios.length === 0) return;
    const isRequired = radios.some((r) => r.required);
    const anyChecked = radios.some((r) => r.checked);
    f.classList.toggle("has-error", isRequired && !anyChecked);
  });
}

/* ============================================================
   6) Construir payload según versión
   ============================================================ */
function construirPayload(form) {
  const version = document.body.dataset.version;
  const fd = new FormData(form);

  const payload = {
    timestamp: new Date().toISOString(),
    version,
    edad: fd.get("edad") || "",
    opinionHorario: fd.get("opinionHorario") || "",
    razonHorario: fd.getAll("razonHorario"),
    razonHorarioDetalle: (fd.get("razonHorarioDetalle") || "").toString().trim(),
    horarioSabado: fd.get("horarioSabado") || "",
    razonSabado: fd.getAll("razonSabado"),
    razonSabadoDetalle: (fd.get("razonSabadoDetalle") || "").toString().trim(),
  };

  if (version === "v1-nombre" || version === "v2") {
    payload.nombre = (fd.get("nombre") || "").toString().trim();
  }

  if (version === "v2") {
    payload.frecuenciaAsistencia = fd.get("frecuenciaAsistencia") || "";
    payload.dificultadTraslado = fd.get("dificultadTraslado") || "";
    payload.atractivoReuniones = fd.getAll("atractivoReuniones");
    payload.atractivoOtroDetalle = (fd.get("atractivoOtroDetalle") || "").toString().trim();
  }

  // Si la calificación es > 3, no enviamos razón (estaba oculta)
  if (Number(payload.opinionHorario) > 3) {
    payload.razonHorario = [];
    payload.razonHorarioDetalle = "";
  }
  if (Number(payload.horarioSabado) > 3) {
    payload.razonSabado = [];
    payload.razonSabadoDetalle = "";
  }

  return payload;
}

/* ============================================================
   7) Submit handler
   ============================================================ */
async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  // HTML5 nativo valida required en inputs/radios visibles
  marcarErroresVisuales(form);
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = construirPayload(form);
  console.log("[Encuesta JF] Payload listo para enviar:", payload);

  const submitBtn = $(".btn-submit");
  submitBtn.disabled = true;
  submitBtn.querySelector("span").textContent = "Enviando...";

  /* === INTEGRACIÓN GOOGLE SHEETS ============================
     DESCOMENTAR cuando GOOGLE_SCRIPT_URL esté configurada.

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",                          // Apps Script no envía CORS por defecto
      headers: { "Content-Type": "text/plain" }, // text/plain evita preflight
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[Encuesta JF] Error al enviar:", err);
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = "Enviar respuesta";
    alert("Hubo un problema al enviar. Por favor, intenta de nuevo.");
    return;
  }
  =========================================================== */

  // Simulamos un pequeño delay para UX coherente
  await new Promise((r) => setTimeout(r, 400));

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    enviadoEn: new Date().toISOString(),
    version: payload.version,
  }));

  showThankYou();
}

/* ============================================================
   8) Mostrar pantalla de gracias
   ============================================================ */
function showThankYou() {
  const form = $("#formContainer");
  const thx = $("#thankYou");
  if (form) form.hidden = true;
  if (thx) {
    thx.hidden = false;
    thx.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ============================================================
   9) Inicialización
   ============================================================ */
function init() {
  // Si ya respondió, mostrar pantalla de gracias directamente
  if (localStorage.getItem(STORAGE_KEY)) {
    showThankYou();
    return;
  }

  setupVersionSwitcher();
  setupCondicionalHorario();
  setupCondicionalSabado();
  updateRequiredFields();

  const form = $("#encuestaForm");
  if (form) form.addEventListener("submit", handleSubmit);

  // Limpieza visual al cambiar selección en grupos required
  $$('input[type="radio"], input[type="checkbox"]').forEach((el) => {
    el.addEventListener("change", () => {
      el.closest(".field")?.classList.remove("has-error");
    });
  });
}

document.addEventListener("DOMContentLoaded", init);

/* ============================================================
   ESTRUCTURA ESPERADA DEL PAYLOAD (referencia)
   ------------------------------------------------------------
   {
     "timestamp": "2026-05-22T18:40:00.000Z",
     "version": "v1" | "v1-nombre" | "v2",
     "nombre": "Juan",                     // solo v1-nombre y v2
     "edad": "15-17" | "18-21" | "22-24" | "25+",
     "opinionHorario": "4",                // "1"-"5"
     "razonHorario": ["Transporte"],       // [] si opinion > 3
     "razonHorarioDetalle": "",
     "horarioSabado": "3",                 // "1"-"5"
     "razonSabado": ["Trabajo", "Otro"],   // [] si horarioSabado > 3
     "razonSabadoDetalle": "",
     "frecuenciaAsistencia": "Siempre",    // solo v2
     "dificultadTraslado": "Un poco",      // solo v2
     "atractivoReuniones": ["Música"],     // solo v2
     "atractivoOtroDetalle": ""            // solo v2
   }
   ============================================================ */
