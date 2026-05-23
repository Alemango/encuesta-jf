/* ============================================================
   Encuesta Jóvenes Filadelfia — Lógica del formulario
   ============================================================ */

/* ============================================================
   ⚙️ CONFIGURACIÓN — Google Sheets

   Pega aquí la URL del Apps Script (termina en "/exec").
   Si la dejas como "TU_URL_AQUÍ" o vacía, el formulario
   funciona localmente y muestra la pantalla de gracias,
   pero NO envía nada al Sheet.

   Pasos detallados al final de este archivo.
   ============================================================ */
const GOOGLE_SCRIPT_URL = "TU_URL_AQUÍ";

const STORAGE_KEY = "jf_encuesta_enviada_v1";

/* ============================================================
   Helpers
   ============================================================ */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* ============================================================
   Pregunta condicional: muestra/oculta el menú de razones
   cuando la escala 1-5 cae en 3 o menos.
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
        $$(`input[name="${checkboxName}"]`).forEach((c) => c.checked = false);
        const detalle = $(`#${detalleId}`);
        if (detalle) detalle.value = "";
      }
    });
  });
}

/* ============================================================
   Highlight visual de campos required sin selección.
   La validación bloqueante la hace HTML5 (reportValidity).
   ============================================================ */
function marcarErroresVisuales() {
  $$(".field").forEach((f) => {
    const radios = $$('input[type="radio"]', f);
    if (radios.length === 0) return;
    const isRequired = radios.some((r) => r.required);
    const anyChecked = radios.some((r) => r.checked);
    f.classList.toggle("has-error", isRequired && !anyChecked);
  });
}

/* ============================================================
   Construir payload listo para enviar a Google Sheets.
   ============================================================ */
function construirPayload(form) {
  const fd = new FormData(form);

  const payload = {
    timestamp: new Date().toISOString(),
    edad: fd.get("edad") || "",
    opinionHorario: fd.get("opinionHorario") || "",
    razonHorario: fd.getAll("razonHorario"),
    razonHorarioDetalle: (fd.get("razonHorarioDetalle") || "").toString().trim(),
    horarioSabado: fd.get("horarioSabado") || "",
    razonSabado: fd.getAll("razonSabado"),
    razonSabadoDetalle: (fd.get("razonSabadoDetalle") || "").toString().trim(),
    dificultadTraslado: fd.get("dificultadTraslado") || "",
  };

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
   Submit handler
   ============================================================ */
async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;

  marcarErroresVisuales();
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const payload = construirPayload(form);
  console.log("[Encuesta JF] Payload:", payload);

  const submitBtn = $(".btn-submit");
  const submitText = submitBtn.querySelector("span");
  submitBtn.disabled = true;
  submitText.textContent = "Enviando...";

  // Envío al Sheet sólo si la URL está configurada
  const tieneURL = GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "TU_URL_AQUÍ";

  if (tieneURL) {
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",                            // Apps Script no envía CORS por defecto
        headers: { "Content-Type": "text/plain" },  // text/plain evita preflight
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("[Encuesta JF] Error al enviar:", err);
      submitBtn.disabled = false;
      submitText.textContent = "Enviar respuesta";
      alert("Hubo un problema al enviar. Revisa tu conexión e intenta de nuevo.");
      return;
    }
  } else {
    console.warn("[Encuesta JF] GOOGLE_SCRIPT_URL no configurada — solo logging local.");
    await new Promise((r) => setTimeout(r, 400));
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    enviadoEn: new Date().toISOString(),
  }));

  showThankYou();
}

/* ============================================================
   Pantalla de gracias
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
   Inicialización
   ============================================================ */
function init() {
  if (localStorage.getItem(STORAGE_KEY)) {
    showThankYou();
    return;
  }

  setupCondicional("opinionHorario", "razonHorario", "razonHorario", "razonHorarioDetalle");
  setupCondicional("horarioSabado", "razonSabado", "razonSabado", "razonSabadoDetalle");

  const form = $("#encuestaForm");
  if (form) form.addEventListener("submit", handleSubmit);

  $$('input[type="radio"], input[type="checkbox"]').forEach((el) => {
    el.addEventListener("change", () => {
      el.closest(".field")?.classList.remove("has-error");
    });
  });
}

document.addEventListener("DOMContentLoaded", init);

/* ============================================================
   📊 INTEGRACIÓN GOOGLE SHEETS — PASOS DETALLADOS
   ============================================================

   1) Crear la hoja de cálculo
      - Ve a https://sheets.new
      - Renombra la pestaña a "Respuestas"
      - En la fila 1, pega esta cabecera (cada celda una columna):

        timestamp | edad | opinionHorario | razonHorario |
        razonHorarioDetalle | horarioSabado | razonSabado |
        razonSabadoDetalle | dificultadTraslado

   2) Crear el Apps Script
      - En el menú: Extensiones → Apps Script
      - Borra el contenido y pega:

        function doPost(e) {
          try {
            const data = JSON.parse(e.postData.contents);
            const sheet = SpreadsheetApp
              .getActiveSpreadsheet()
              .getSheetByName("Respuestas");
            sheet.appendRow([
              data.timestamp,
              data.edad || "",
              data.opinionHorario || "",
              (data.razonHorario || []).join(", "),
              data.razonHorarioDetalle || "",
              data.horarioSabado || "",
              (data.razonSabado || []).join(", "),
              data.razonSabadoDetalle || "",
              data.dificultadTraslado || "",
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

      - Guarda (💾) con cualquier nombre (ej. "Encuesta JF").

   3) Desplegar como Web App
      - Click en Deploy → New deployment
      - Type: Web app
      - Description: "Encuesta JF v1"
      - Execute as: Me (tu cuenta)
      - Who has access: Anyone
      - Click Deploy. Autoriza permisos cuando lo pida.
      - Copia la URL "Web app" (termina en /exec).

   4) Pegar la URL aquí arriba
      - Reemplaza "TU_URL_AQUÍ" en GOOGLE_SCRIPT_URL (línea 14).
      - Sube los cambios a GitHub → Pages republica solo.

   5) Probar
      - Abre el form, llénalo y envía.
      - Revisa el Sheet → debe aparecer una nueva fila.
      - Si no aparece: abre DevTools → Console → busca errores.

   --- IMPORTANTE ---
   - "mode: no-cors" significa que el navegador NO puede leer
     la respuesta del Apps Script. Es normal y funciona igual.
   - Cada vez que cambies el código del Apps Script DEBES
     desplegar una nueva versión (Deploy → Manage deployments
     → editar la activa → Version: New version).
   - La cabecera del Sheet sólo se pone UNA vez en la fila 1;
     después el script solo añade filas.

   ============================================================
   ESTRUCTURA DEL PAYLOAD
   ------------------------------------------------------------
   {
     "timestamp": "2026-05-22T18:40:00.000Z",
     "edad": "15-17" | "18-21" | "22-24" | "25+",
     "opinionHorario": "4",                       // "1"-"5"
     "razonHorario": ["Transporte"],              // [] si > 3
     "razonHorarioDetalle": "",
     "horarioSabado": "3",                        // "1"-"5"
     "razonSabado": ["Trabajo", "Otro"],          // [] si > 3
     "razonSabadoDetalle": "",
     "dificultadTraslado": "Un poco complicado"
   }
   ============================================================ */
