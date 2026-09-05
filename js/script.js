// ================================================================
// ESTADO GLOBAL
// ================================================================
let selectedDocument = null;
let photoData = "";
let photoPosition = { x: 24, y: 24 }; // posición libre de la foto dentro del CV, en px
let currentTheme = "indigo";
let currentColor = "#2A3B6B";
let currentStyle = "classic";
let autoSaveTimer = null;

const el = id => document.getElementById(id);
const valor = id => { const e = el(id); return e ? e.value.trim() : ""; };

// ================================================================
// TOASTS
// ================================================================
function toast(mensaje, tipo = "") {
  const stack = el("toastStack");
  const item = document.createElement("div");
  item.className = "toast" + (tipo ? " " + tipo : "");
  item.textContent = mensaje;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 4200);
}

// ================================================================
// MODO OSCURO
// ================================================================
const themeToggle = el("themeToggle");
const themeLabel = el("themeLabel");
let darkMode = localStorage.getItem("dossierCV_dark") === "true";

function applyTheme(dark) {
  document.body.classList.toggle("dark", dark);
  themeLabel.textContent = dark ? "Claro" : "Oscuro";
  themeToggle.innerHTML = dark ? "☀️ <span id=\"themeLabel\">Claro</span>" :
    "🌙 <span id=\"themeLabel\">Oscuro</span>";
  localStorage.setItem("dossierCV_dark", dark);
}

themeToggle.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme(darkMode);
});

applyTheme(darkMode);

// ================================================================
// GUARDADO AUTOMÁTICO
// ================================================================
function guardarAutomatico() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const datos = recogerDatos();
    try {
      localStorage.setItem("dossierCV_data", JSON.stringify(datos));
    } catch (e) { /* ignore */ }
  }, 800);
}

// ================================================================
// PROGRESO GLOBAL
// ================================================================
function actualizarProgreso() {
  const steps = document.querySelectorAll(".step[data-step]");
  let completados = 0;
  steps.forEach(step => {
    const num = parseInt(step.dataset.step);
    let completo = false;
    switch (num) {
      case 1:
        completo = el("ocrText").value.trim().length > 0 || selectedDocument !== null;
        break;
      case 2:
        completo = valor("nombre").length > 0 || valor("apellidos").length > 0 ||
          valor("email").length > 0 || valor("telefono").length > 0;
        break;
      case 3:
        completo = document.querySelectorAll("#experiencias .item-card").length > 0 ||
          document.querySelectorAll("#formaciones .item-card").length > 0 ||
          document.querySelectorAll("#certificaciones .item-card").length > 0 ||
          document.querySelectorAll("#referencias .item-card").length > 0 ||
          valor("idiomas").length > 0 || valor("habilidades").length > 0;
        break;
      case 4:
      case 5:
        completo = true;
        break;
      default:
        completo = false;
    }
    if (completo) completados++;
  });

  const pct = Math.round((completados / 5) * 100);
  el("progressBarGlobal").style.width = pct + "%";
  el("progressStepsText").textContent = `${completados} / 5 pasos completados`;
}

// ================================================================
// ESCANEO
// ================================================================
const cameraInput = el("cameraInput");
const galleryInput = el("galleryInput");
const documentPreview = el("documentPreview");
const fileNameEl = el("fileName");
const ocrButton = el("ocrButton");
const scannerZone = el("scannerZone");

cameraInput.addEventListener("change", async function() {
  if (!this.files.length) return;
  seleccionarDocumento(this.files[0]);
  await ejecutarOCR(this.files[0]);
});

galleryInput.addEventListener("change", function() {
  if (!this.files.length) return;
  seleccionarDocumento(this.files[0]);
});

["dragenter", "dragover"].forEach(evt =>
  scannerZone.addEventListener(evt, e => { e.preventDefault();
    scannerZone.classList.add("drag-over"); })
);
["dragleave", "drop"].forEach(evt =>
  scannerZone.addEventListener(evt, e => { e.preventDefault();
    scannerZone.classList.remove("drag-over"); })
);
scannerZone.addEventListener("drop", e => {
  const file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast("Suelta una imagen JPG o PNG.", "error"); return; }
  seleccionarDocumento(file);
});

function seleccionarDocumento(file) {
  selectedDocument = file;
  fileNameEl.textContent = "Archivo: " + file.name;
  if (file.type.startsWith("image/")) {
    documentPreview.src = URL.createObjectURL(file);
    documentPreview.style.display = "block";
  }
  guardarAutomatico();
  actualizarProgreso();
}

ocrButton.addEventListener("click", async function() {
  if (!selectedDocument) { toast("Primero haz una foto o selecciona una imagen.", "error"); return; }
  await ejecutarOCR(selectedDocument);
});

async function ejecutarOCR(file) {
  if (!file.type.startsWith("image/")) { toast("Selecciona una imagen JPG o PNG.", "error"); return; }

  const progressArea = el("progressArea");
  const progressBar = el("progressBar");
  const status = el("ocrStatus");

  progressArea.style.display = "block";
  progressBar.style.width = "0%";
  ocrButton.disabled = true;

  try {
    status.textContent = "Preparando lectura…";

    const result = await Tesseract.recognize(file, "spa+eng", {
      logger: info => {
        if (typeof info.progress === "number") {
          const percent = Math.round(info.progress * 100);
          progressBar.style.width = percent + "%";
          status.textContent = "Analizando: " + percent + "%";
        }
      }
    });

    const text = result.data.text;
    el("ocrText").value = text;
    progressBar.style.width = "100%";
    status.textContent = "Documento leído correctamente ✅";
    toast("Documento leído. Revisa los datos detectados.", "ok");
    analizarTexto(text);
    guardarAutomatico();
    actualizarProgreso();

  } catch (error) {
    console.error(error);
    status.textContent = "No se pudo leer el documento";
    toast("No se pudo leer el documento. Prueba con más luz o menos reflejos.", "error");
  } finally {
    ocrButton.disabled = false;
  }
}

// ================================================================
// ANALIZADOR DE TEXTO
// ================================================================
function analizarTexto(texto) {
  const original = texto || "";
  const mayus = original.toUpperCase();

  const nieMatch = mayus.match(/\b[XYZ]\s?\d{7,9}\s?[A-Z]\b/);
  const dniMatch = mayus.match(/\b\d{8}\s?[A-Z]\b/);
  const docMatch = nieMatch || dniMatch;
  if (docMatch && !valor("nie")) {
    el("nie").value = docMatch[0].replace(/\s/g, "");
  }

  const telMatch = original.match(/(?:\+34[\s-]?)?[6789]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/);
  if (telMatch && !valor("telefono")) el("telefono").value = telMatch[0].trim();

  const emailMatch = original.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch && !valor("email")) el("email").value = emailMatch[0];

  const nombreApellidos = extraerNombreApellidosMejorado(original);
  if (nombreApellidos) {
    if (!valor("nombre")) el("nombre").value = nombreApellidos.nombre;
    if (!valor("apellidos")) el("apellidos").value = nombreApellidos.apellidos;
  }

  actualizarCV();
  guardarAutomatico();
  actualizarProgreso();
}

function extraerNombreApellidosMejorado(texto) {
  const lineas = texto.split(/\r?\n/).map(x => x.trim()).filter(x => x.length > 3);
  for (let i = 0; i < lineas.length; i++) {
    const mayus = lineas[i].toUpperCase();
    if (/APELLID|SURNAME/.test(mayus)) {
      for (let j = i + 1; j < Math.min(i + 3, lineas.length); j++) {
        const candidata = lineas[j];
        if (!candidata) continue;
        const limpio = candidata.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "").trim();
        const palabras = limpio.split(/\s+/).filter(Boolean);
        if (palabras.length >= 2 && palabras.length <= 5 && limpio.length >= 4) {
          const nombre = palabras.pop() || "";
          const apellidos = palabras.join(" ");
          if (nombre.length > 0 && apellidos.length > 0) {
            return { nombre, apellidos };
          }
        }
      }
      break;
    }
  }

  const prohibidas = ["NOMBRE", "APELLIDOS", "SURNAME", "FORENAME", "NIE", "DOCUMENTO", "FECHA", "NACIMIENTO",
    "BIRTH", "EXPEDICION", "CADUCIDAD", "SEXO", "DNI", "ESPAÑA", "REINO", "PERMISO", "RESIDENCIA",
    "TELÉFONO", "EMAIL", "DIRECCIÓN", "CIUDAD", "PROFESIÓN"
  ];
  for (const linea of lineas) {
    const mayus = linea.toUpperCase();
    if (prohibidas.some(p => mayus.includes(p))) continue;
    const limpio = linea.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "").trim();
    const palabras = limpio.split(/\s+/).filter(Boolean);
    if (palabras.length >= 2 && palabras.length <= 5 && limpio.length >= 6) {
      const nombre = palabras.shift() || "";
      const apellidos = palabras.join(" ");
      return { nombre, apellidos };
    }
  }
  return null;
}

// ================================================================
// VALIDACIÓN
// ================================================================
el("email").addEventListener("blur", () => {
  const v = valor("email");
  const msg = el("emailMsg");
  if (!v) { msg.textContent = ""; return; }
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  msg.textContent = ok ? "✅" : "Revisa el formato del correo.";
  msg.className = "msg" + (ok ? " ok" : " error");
  guardarAutomatico();
});

el("telefono").addEventListener("blur", () => {
  const v = valor("telefono");
  const msg = el("telefonoMsg");
  if (!v) { msg.textContent = ""; return; }
  const ok = /^(\+?\d[\d\s-]{7,14}\d)$/.test(v);
  msg.textContent = ok ? "✅" : "Revisa el formato del teléfono.";
  msg.className = "msg" + (ok ? " ok" : " error");
  guardarAutomatico();
});

// ================================================================
// ITEMS DINÁMICOS (drag & drop)
// ================================================================
function escapeHTML(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function initSortable(containerId) {
  const container = el(containerId);
  if (!container) return;
  let dragItem = null;

  container.addEventListener("dragstart", (e) => {
    const item = e.target.closest(".item-card");
    if (!item) return;
    dragItem = item;
    item.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "");
  });

  container.addEventListener("dragend", (e) => {
    const item = e.target.closest(".item-card");
    if (item) item.classList.remove("dragging");
    dragItem = null;
  });

  container.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const afterElement = getDragAfterElement(container, e.clientY);
    const currentItem = e.target.closest(".item-card");
    if (!currentItem || currentItem === dragItem) return;
    if (afterElement == null) {
      container.appendChild(dragItem);
    } else {
      container.insertBefore(dragItem, afterElement);
    }
  });

  container.addEventListener("drop", (e) => {
    e.preventDefault();
    guardarAutomatico();
    actualizarCV();
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll(".item-card:not(.dragging)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function crearItemCard(titulo, camposHTML, containerId, emptyId) {
  const container = el(containerId);
  el(emptyId).style.display = "none";
  const item = document.createElement("div");
  item.className = "item-card";
  item.draggable = true;
  item.innerHTML = `
    <div class="drag-handle" draggable="false">⠿</div>
    <div class="item-head">
      <strong>${titulo}</strong>
      <button type="button" class="btn btn-danger btn-sm" onclick="eliminarItem(this,'${containerId}','${emptyId}')">Eliminar</button>
    </div>
    ${camposHTML}
  `;
  container.appendChild(item);
  item.querySelectorAll("input, textarea").forEach(e => e.addEventListener("input", () => {
    actualizarCV();
    guardarAutomatico();
    actualizarProgreso();
  }));
  actualizarCV();
  guardarAutomatico();
  actualizarProgreso();
  return item;
}

function agregarExperiencia(datos = {}) {
  const campos = `
    <div class="form-grid" style="gap:0.8rem;">
      <div class="field"><label>Puesto</label><input class="exp-puesto" value="${escapeHTML(datos.puesto || "")}" placeholder="Desarrollador" /></div>
      <div class="field"><label>Empresa</label><input class="exp-empresa" value="${escapeHTML(datos.empresa || "")}" placeholder="Empresa S.L." /></div>
    </div>
    <div class="form-grid" style="gap:0.8rem;">
      <div class="field"><label>Fecha inicio</label><input class="exp-inicio" value="${escapeHTML(datos.inicio || "")}" placeholder="2022" /></div>
      <div class="field"><label>Fecha fin</label><input class="exp-fin" value="${escapeHTML(datos.fin || "")}" placeholder="Actualidad" /></div>
    </div>
    <div class="field"><label>Funciones</label><textarea class="exp-descripcion" placeholder="Describe tus funciones…">${escapeHTML(datos.descripcion || "")}</textarea></div>
  `;
  crearItemCard("Experiencia", campos, "experiencias", "expEmpty");
}

function agregarFormacion(datos = {}) {
  const campos = `
    <div class="form-grid" style="gap:0.8rem;">
      <div class="field"><label>Título</label><input class="form-titulo" value="${escapeHTML(datos.titulo || "")}" placeholder="Grado / Curso" /></div>
      <div class="field"><label>Centro</label><input class="form-centro" value="${escapeHTML(datos.centro || "")}" placeholder="Centro de estudios" /></div>
    </div>
    <div class="field"><label>Año</label><input class="form-ano" value="${escapeHTML(datos.ano || "")}" placeholder="2024" /></div>
  `;
  crearItemCard("Formación", campos, "formaciones", "formEmpty");
}

function agregarCertificacion(datos = {}) {
  const campos = `
    <div class="form-grid" style="gap:0.8rem;">
      <div class="field"><label>Título</label><input class="cert-titulo" value="${escapeHTML(datos.titulo || "")}" placeholder="Certificado profesional" /></div>
      <div class="field"><label>Entidad</label><input class="cert-entidad" value="${escapeHTML(datos.entidad || "")}" placeholder="Entidad / plataforma" /></div>
    </div>
    <div class="field"><label>Año</label><input class="cert-ano" value="${escapeHTML(datos.ano || "")}" placeholder="2024" /></div>
  `;
  crearItemCard("Certificación", campos, "certificaciones", "certEmpty");
}

function agregarReferencia(datos = {}) {
  const campos = `
    <div class="form-grid" style="gap:0.8rem;">
      <div class="field"><label>Nombre</label><input class="ref-nombre" value="${escapeHTML(datos.nombre || "")}" placeholder="Nombre y apellidos" /></div>
      <div class="field"><label>Relación / cargo</label><input class="ref-relacion" value="${escapeHTML(datos.relacion || "")}" placeholder="Antiguo responsable" /></div>
    </div>
    <div class="field"><label>Contacto</label><input class="ref-contacto" value="${escapeHTML(datos.contacto || "")}" placeholder="Teléfono o email" /></div>
  `;
  crearItemCard("Referencia", campos, "referencias", "refEmpty");
}

function eliminarItem(boton, containerId, emptyId) {
  boton.closest(".item-card").remove();
  const container = el(containerId);
  if (!container.querySelector(".item-card")) el(emptyId).style.display = "block";
  actualizarCV();
  guardarAutomatico();
  actualizarProgreso();
}

initSortable("experiencias");
initSortable("formaciones");
initSortable("certificaciones");
initSortable("referencias");

// ================================================================
// FOTO
// ================================================================
const photoInput = el("photoInput");
photoInput.addEventListener("change", function() {
  if (!this.files.length) return;
  const file = this.files[0];
  if (!file.type.startsWith("image/")) { toast("Selecciona una imagen para la foto.", "error"); return; }
  const reader = new FileReader();
  reader.onload = event => {
    photoData = event.target.result;
    el("photoThumb").src = photoData;
    el("photoThumb").style.display = "block";
    el("quitarFotoBtn").style.display = "inline-flex";
    guardarAutomatico();
    actualizarCV();
  };
  reader.readAsDataURL(file);
});

function quitarFoto() {
  photoData = "";
  photoPosition = { x: 24, y: 24 };
  photoInput.value = "";
  el("photoThumb").style.display = "none";
  el("quitarFotoBtn").style.display = "none";
  guardarAutomatico();
  actualizarCV();
}

// ================================================================
// CAMBIAR ESTILO
// ================================================================
function cambiarEstilo(estilo, elemento) {
  currentStyle = estilo;
  document.querySelectorAll(".style-item").forEach(x => x.classList.remove("active"));
  elemento.classList.add("active");
  actualizarCV();
  guardarAutomatico();
}

// ================================================================
// CAMBIAR COLOR
// ================================================================
function cambiarTema(tema, color, elemento) {
  currentTheme = tema;
  currentColor = color;
  document.querySelectorAll(".template-item").forEach(x => x.classList.remove("active"));
  elemento.classList.add("active");
  actualizarCV();
  guardarAutomatico();
}

// ================================================================
// RENDERIZAR CV SEGÚN ESTILO
// ================================================================
function actualizarCV() {
  const cv = el("cv");
  // Establecer clase de estilo
  cv.className = "cv-" + currentStyle;
  cv.style.setProperty("--cv-accent", currentColor);

  const nombre = valor("nombre") || "TU NOMBRE";
  const apellidos = valor("apellidos") || "";
  const nombreCompleto = (`${nombre} ${apellidos}`).trim().toUpperCase();

  // Construir HTML según estilo
  let html = '';

  // Cabecera común. La foto YA NO va aquí dentro: ahora es un elemento
  // flotante y arrastrable que se coloca donde el usuario quiera sobre
  // el CV (ver renderFotoFlotante() e initPhotoDrag() más abajo).
  const headerContent = `
    <div class="cv-header">
      <div>
        <div class="cv-name">${nombreCompleto}</div>
        <div class="cv-job">${valor("puesto") || "PROFESIONAL"}</div>
      </div>
    </div>
  `;

  // Sidebar (contacto, idiomas, habilidades)
  const sidebarContent = `
    <aside class="cv-sidebar">
      <div class="cv-section">
        <h3>Contacto</h3>
        <div class="contact-item"><strong>Teléfono</strong><span>${valor("telefono") || "—"}</span></div>
        <div class="contact-item"><strong>Email</strong><span>${valor("email") || "—"}</span></div>
        <div class="contact-item"><strong>Ubicación</strong><span>${valor("direccion") || "—"}</span></div>
        <div class="contact-item"><strong>LinkedIn</strong><span>${valor("linkedin") || "—"}</span></div>
        <div class="contact-item"><strong>Web</strong><span>${valor("web") || "—"}</span></div>
      </div>
      <div class="cv-section">
        <h3>Idiomas</h3>
        <p>${valor("idiomas") || "—"}</p>
      </div>
      <div class="cv-section">
        <h3>Habilidades</h3>
        <div class="badges">
          ${renderHabilidades()}
        </div>
      </div>
    </aside>
  `;

  // Main (perfil, experiencia, formación, certificaciones, referencias)
  const mainContent = `
    <main class="cv-main">
      <div class="cv-section">
        <h3>Perfil</h3>
        <p>${valor("perfil") || "Escribe tu perfil profesional."}</p>
      </div>
      <div class="cv-section">
        <h3>Experiencia profesional</h3>
        ${renderExperiencias()}
      </div>
      <div class="cv-section">
        <h3>Formación</h3>
        ${renderFormaciones()}
      </div>
      <div class="cv-section">
        <h3>Certificaciones</h3>
        ${renderCertificaciones()}
      </div>
      <div class="cv-section">
        <h3>Referencias</h3>
        ${renderReferencias()}
      </div>
    </main>
  `;

  // Construir según estilo (todos los estilos comparten la misma
  // estructura header + body[sidebar, main]; se simplifica aquí ya que
  // la maquetación específica de cada plantilla la resuelve el CSS).
  const usaWrapperNeutro = ["modern", "minimal", "creative", "double", "photobig", "skills"].includes(currentStyle);

  if (usaWrapperNeutro) {
    html = headerContent + `
      <div class="cv-body">
        <div class="cv-sidebar">${sidebarContent.replace('<aside class="cv-sidebar">', '<div>').replace('</aside>', '</div>')}</div>
        <div class="cv-main">${mainContent.replace('<main class="cv-main">', '<div>').replace('</main>', '</div>')}</div>
      </div>
    `;
  } else {
    html = headerContent + `
      <div class="cv-body">
        ${sidebarContent}
        ${mainContent}
      </div>
    `;
  }

  cv.innerHTML = html;

  // Foto flotante y arrastrable, colocada por encima del resto del CV
  if (photoData) {
    cv.insertAdjacentHTML("beforeend", renderFotoFlotante());
    initPhotoDrag();
  }

  actualizarProgreso();
}

// ================================================================
// FOTO FLOTANTE Y ARRASTRABLE
// ================================================================
function renderFotoFlotante() {
  if (!photoData) return "";
  return `
    <div id="cvPhotoWrap" class="cv-photo-wrap" style="left:${photoPosition.x}px; top:${photoPosition.y}px;" title="Arrastra para colocar la foto donde quieras">
      <img id="cvPhoto" class="cv-photo" src="${photoData}" alt="Foto" draggable="false" />
    </div>
  `;
}

function initPhotoDrag() {
  const wrap = el("cvPhotoWrap");
  const cv = el("cv");
  if (!wrap || !cv) return;

  let arrastrando = false;
  let inicioX = 0, inicioY = 0, inicioLeft = 0, inicioTop = 0;

  wrap.addEventListener("pointerdown", (e) => {
    arrastrando = true;
    wrap.setPointerCapture(e.pointerId);
    inicioX = e.clientX;
    inicioY = e.clientY;
    inicioLeft = photoPosition.x;
    inicioTop = photoPosition.y;
    wrap.classList.add("dragging");
  });

  wrap.addEventListener("pointermove", (e) => {
    if (!arrastrando) return;
    const wrapRect = wrap.getBoundingClientRect();
    const maxX = cv.clientWidth - wrapRect.width;
    const maxY = cv.clientHeight - wrapRect.height;

    let nuevaX = inicioLeft + (e.clientX - inicioX);
    let nuevaY = inicioTop + (e.clientY - inicioY);
    nuevaX = Math.max(0, Math.min(nuevaX, maxX));
    nuevaY = Math.max(0, Math.min(nuevaY, maxY));

    photoPosition.x = nuevaX;
    photoPosition.y = nuevaY;
    wrap.style.left = nuevaX + "px";
    wrap.style.top = nuevaY + "px";
  });

  function soltar(e) {
    if (!arrastrando) return;
    arrastrando = false;
    wrap.classList.remove("dragging");
    guardarAutomatico();
  }

  wrap.addEventListener("pointerup", soltar);
  wrap.addEventListener("pointercancel", soltar);
}

// ================================================================
// FUNCIONES AUXILIARES PARA RENDERIZAR LISTAS
// ================================================================
function renderHabilidades() {
  const habilidades = valor("habilidades").split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
  if (!habilidades.length) return "—";
  return habilidades.map(h => `<span class="badge">${escapeHTML(h)}</span>`).join('');
}

function renderExperiencias() {
  const items = document.querySelectorAll("#experiencias .item-card");
  if (!items.length) return "Añade tu experiencia profesional.";
  let html = '';
  items.forEach(item => {
    const puesto = item.querySelector(".exp-puesto").value.trim();
    const empresa = item.querySelector(".exp-empresa").value.trim();
    const inicio = item.querySelector(".exp-inicio").value.trim();
    const fin = item.querySelector(".exp-fin").value.trim();
    const descripcion = item.querySelector(".exp-descripcion").value.trim();
    html += `
      <div class="cv-experience">
        <div class="cv-experience-title">${escapeHTML(puesto || "Puesto")}</div>
        <div class="cv-company">${escapeHTML(empresa)}</div>
        <div class="cv-date">${escapeHTML(inicio)}${inicio || fin ? " — " : ""}${escapeHTML(fin)}</div>
        <div><p>${escapeHTML(descripcion || "Descripción.")}</p></div>
      </div>
    `;
  });
  return html;
}

function renderFormaciones() {
  const items = document.querySelectorAll("#formaciones .item-card");
  if (!items.length) return "Añade tu formación.";
  let html = '';
  items.forEach(item => {
    const titulo = item.querySelector(".form-titulo").value.trim();
    const centro = item.querySelector(".form-centro").value.trim();
    const ano = item.querySelector(".form-ano").value.trim();
    html += `
      <div class="cv-experience">
        <div class="cv-experience-title">${escapeHTML(titulo || "Formación")}</div>
        <div class="cv-company">${escapeHTML(centro)}</div>
        <div class="cv-date">${escapeHTML(ano)}</div>
      </div>
    `;
  });
  return html;
}

function renderCertificaciones() {
  const items = document.querySelectorAll("#certificaciones .item-card");
  if (!items.length) return "Añade certificaciones si tienes.";
  let html = '';
  items.forEach(item => {
    const titulo = item.querySelector(".cert-titulo").value.trim();
    const entidad = item.querySelector(".cert-entidad").value.trim();
    const ano = item.querySelector(".cert-ano").value.trim();
    html += `
      <div class="cv-experience">
        <div class="cv-experience-title">${escapeHTML(titulo || "Certificación")}</div>
        <div class="cv-company">${escapeHTML(entidad)}</div>
        <div class="cv-date">${escapeHTML(ano)}</div>
      </div>
    `;
  });
  return html;
}

function renderReferencias() {
  const items = document.querySelectorAll("#referencias .item-card");
  if (!items.length) return "Disponibles a petición.";
  let html = '';
  items.forEach(item => {
    const nombre = item.querySelector(".ref-nombre").value.trim();
    const relacion = item.querySelector(".ref-relacion").value.trim();
    const contacto = item.querySelector(".ref-contacto").value.trim();
    html += `
      <div class="cv-experience">
        <div class="cv-experience-title">${escapeHTML(nombre || "Referencia")}</div>
        <div class="cv-company">${escapeHTML(relacion)}</div>
        <div class="cv-date">${escapeHTML(contacto)}</div>
      </div>
    `;
  });
  return html;
}

// ================================================================
// GUARDAR Y CARGAR COPIA (JSON + localStorage)
// ================================================================
function recogerDatos() {
  return {
    nombre: valor("nombre"),
    apellidos: valor("apellidos"),
    nie: valor("nie"),
    telefono: valor("telefono"),
    email: valor("email"),
    direccion: valor("direccion"),
    linkedin: valor("linkedin"),
    web: valor("web"),
    puesto: valor("puesto"),
    perfil: valor("perfil"),
    idiomas: valor("idiomas"),
    habilidades: valor("habilidades"),
    experiencias: Array.from(document.querySelectorAll("#experiencias .item-card")).map(item => ({
      puesto: item.querySelector(".exp-puesto").value,
      empresa: item.querySelector(".exp-empresa").value,
      inicio: item.querySelector(".exp-inicio").value,
      fin: item.querySelector(".exp-fin").value,
      descripcion: item.querySelector(".exp-descripcion").value
    })),
    formaciones: Array.from(document.querySelectorAll("#formaciones .item-card")).map(item => ({
      titulo: item.querySelector(".form-titulo").value,
      centro: item.querySelector(".form-centro").value,
      ano: item.querySelector(".form-ano").value
    })),
    certificaciones: Array.from(document.querySelectorAll("#certificaciones .item-card")).map(item => ({
      titulo: item.querySelector(".cert-titulo").value,
      entidad: item.querySelector(".cert-entidad").value,
      ano: item.querySelector(".cert-ano").value
    })),
    referencias: Array.from(document.querySelectorAll("#referencias .item-card")).map(item => ({
      nombre: item.querySelector(".ref-nombre").value,
      relacion: item.querySelector(".ref-relacion").value,
      contacto: item.querySelector(".ref-contacto").value
    })),
    photo: photoData,
    photoPosition: photoPosition,
    theme: currentTheme,
    color: currentColor,
    style: currentStyle,
    darkMode: darkMode
  };
}

function exportarJSON() {
  const datos = recogerDatos();
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cv-datos-" + (valor("nombre") || "borrador").replace(/\s+/g, "-").toLowerCase() + ".json";
  a.click();
  URL.revokeObjectURL(url);
  toast("Copia guardada como archivo JSON.", "ok");
}

el("importInput").addEventListener("change", function() {
  if (!this.files.length) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const datos = JSON.parse(e.target.result);
      cargarDatos(datos);
      toast("Copia cargada correctamente.", "ok");
    } catch (err) {
      console.error(err);
      toast("El archivo no es una copia válida.", "error");
    }
  };
  reader.readAsText(this.files[0]);
  this.value = "";
});

function cargarDatos(datos) {
  const campos = ["nombre", "apellidos", "nie", "telefono", "email", "direccion", "linkedin", "web", "puesto",
    "perfil", "idiomas", "habilidades"
  ];
  campos.forEach(id => { if (datos[id] !== undefined) el(id).value = datos[id]; });

  document.querySelectorAll("#experiencias .item-card").forEach(i => i.remove());
  document.querySelectorAll("#formaciones .item-card").forEach(i => i.remove());
  document.querySelectorAll("#certificaciones .item-card").forEach(i => i.remove());
  document.querySelectorAll("#referencias .item-card").forEach(i => i.remove());
  el("expEmpty").style.display = "block";
  el("formEmpty").style.display = "block";
  el("certEmpty").style.display = "block";
  el("refEmpty").style.display = "block";

  if (Array.isArray(datos.experiencias)) datos.experiencias.forEach(exp => agregarExperiencia(exp));
  if (Array.isArray(datos.formaciones)) datos.formaciones.forEach(f => agregarFormacion(f));
  if (Array.isArray(datos.certificaciones)) datos.certificaciones.forEach(c => agregarCertificacion(c));
  if (Array.isArray(datos.referencias)) datos.referencias.forEach(r => agregarReferencia(r));

  if (datos.photo) {
    photoData = datos.photo;
    // Compatibilidad con copias antiguas que no guardaban posición
    photoPosition = datos.photoPosition && typeof datos.photoPosition.x === "number"
      ? datos.photoPosition
      : { x: 24, y: 24 };
    el("photoThumb").src = photoData;
    el("photoThumb").style.display = "block";
    el("quitarFotoBtn").style.display = "inline-flex";
  } else {
    quitarFoto();
  }

  if (datos.style) {
    currentStyle = datos.style;
    document.querySelectorAll(".style-item").forEach(x => x.classList.remove("active"));
    const styleEl = document.querySelector(`.style-item[data-style="${datos.style}"]`);
    if (styleEl) styleEl.classList.add("active");
  }

  if (datos.theme && datos.color) {
    currentTheme = datos.theme;
    currentColor = datos.color;
    document.querySelectorAll(".template-item").forEach(x => x.classList.remove("active"));
    const colorEl = document.querySelector(`.template-item[data-theme="${datos.theme}"]`);
    if (colorEl) colorEl.classList.add("active");
  }

  if (datos.darkMode !== undefined) {
    darkMode = datos.darkMode;
    applyTheme(darkMode);
  }

  actualizarCV();
  guardarAutomatico();
  actualizarProgreso();
}

// ================================================================
// PDF
// ================================================================
async function descargarPDF() {
  actualizarCV();
  const cv = el("cv");
  toast("Generando PDF…");

  try {
    const canvas = await html2canvas(cv, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const nombre = valor("nombre") || "CV";
    pdf.save("CV-" + nombre.replace(/\s+/g, "-") + ".pdf");
    toast("PDF descargado.", "ok");

  } catch (error) {
    console.error(error);
    toast("No se pudo crear el PDF.", "error");
  }
}

// ================================================================
// BORRAR TODO
// ================================================================
function limpiarTodo() {
  if (!confirm("¿Quieres borrar todos los datos y empezar de nuevo?"))
    return;

  document.querySelectorAll("input, textarea").forEach(e => { if (e.type !== "file") e.value = ""; });
  document.querySelectorAll("#experiencias .item-card, #formaciones .item-card, #certificaciones .item-card, #referencias .item-card")
    .forEach(i => i.remove());
  el("expEmpty").style.display = "block";
  el("formEmpty").style.display = "block";
  el("certEmpty").style.display = "block";
  el("refEmpty").style.display = "block";
  quitarFoto();
  selectedDocument = null;
  fileNameEl.textContent = "Ningún archivo seleccionado";
  documentPreview.style.display = "none";
  el("ocrText").value = "";
  currentStyle = "classic";
  currentColor = "#2A3B6B";
  document.querySelectorAll(".style-item").forEach(x => x.classList.remove("active"));
  document.querySelector('.style-item[data-style="classic"]').classList.add("active");
  document.querySelectorAll(".template-item").forEach(x => x.classList.remove("active"));
  document.querySelector('.template-item[data-theme="indigo"]').classList.add("active");
  localStorage.removeItem("dossierCV_data");
  actualizarCV();
  actualizarProgreso();
  toast("Datos borrados.");
}

// ================================================================
// CARGA AUTOMÁTICA DESDE LOCALSTORAGE
// ================================================================
function cargarDesdeLocalStorage() {
  const stored = localStorage.getItem("dossierCV_data");
  if (!stored) return;
  try {
    const datos = JSON.parse(stored);
    cargarDatos(datos);
    toast("Datos recuperados automáticamente.", "ok");
  } catch (e) { /* ignore */ }
}

// ================================================================
// INICIALIZACIÓN
// ================================================================
document.querySelectorAll("input, textarea").forEach(e => e.addEventListener("input", () => {
  actualizarCV();
  guardarAutomatico();
  actualizarProgreso();
}));

cargarDesdeLocalStorage();
actualizarCV();
actualizarProgreso();

// Exponer funciones globales (necesarias por los atributos onclick del HTML)
window.agregarExperiencia = agregarExperiencia;
window.agregarFormacion = agregarFormacion;
window.agregarCertificacion = agregarCertificacion;
window.agregarReferencia = agregarReferencia;
window.eliminarItem = eliminarItem;
window.quitarFoto = quitarFoto;
window.cambiarEstilo = cambiarEstilo;
window.cambiarTema = cambiarTema;
window.exportarJSON = exportarJSON;
window.descargarPDF = descargarPDF;
window.limpiarTodo = limpiarTodo;
window.actualizarCV = actualizarCV;

// ================================================================
// POPUP REHMAN EXPRESS MARKET CADA 5 MINUTOS
// ================================================================
const popupRehman = document.getElementById("popupRehman");

function mostrarPopupRehman() {
  if (!popupRehman) return;
  popupRehman.classList.add("show");
  popupRehman.setAttribute("aria-hidden", "false");
}

function cerrarPopupRehman() {
  if (!popupRehman) return;
  popupRehman.classList.remove("show");
  popupRehman.setAttribute("aria-hidden", "true");
}

// Primera aparición: después de 5 minutos, y luego cada 5 minutos
setTimeout(() => {
  mostrarPopupRehman();
  setInterval(mostrarPopupRehman, 5 * 60 * 1000);
}, 5 * 60 * 1000);

// Cerrar al pulsar fuera de la ventana
if (popupRehman) {
  popupRehman.addEventListener("click", function(event) {
    if (event.target === popupRehman) cerrarPopupRehman();
  });
}

// Cerrar también con la tecla ESC
document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") cerrarPopupRehman();
});

window.cerrarPopupRehman = cerrarPopupRehman;
