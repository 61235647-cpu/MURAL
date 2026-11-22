// ============================================
// SUPABASE: conexión para el Mural Oxapampino
// La clave publishable puede estar en el frontend.
// Nunca coloques aquí una service_role/secret key.
// ============================================
const SUPABASE_URL = "https://sfdotyphtudkuomltxht.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ea8h4bdeQBYuL0bNtdP3Ww_DQ-kGdQF";
const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
const SUPABASE_TABLE = "mural_posts";

// Estado inicial de ejemplo para MURALOXAPAMPINO
const INITIAL_NOTES = [
  {
    id: "vip-1",
    plan: "vip",
    color: "#b91c1c",
    category: "oferta",
    author: "Ferretería & Acabados Oxa",
    title: "Lote de Planchas OSB y Calaminas Galvanizadas",
    content: "Stock disponible para entrega inmediata en Oxapampa. Cotizaciones al instante para obra y techos.",
    contact: "952640224",
    link: "",
    mediaType: null,
    mediaUrl: null,
    status: "approved",
    reports: 0,
    createdAt: Date.now() - 3600 * 1000 * 4,
    expiresAt: Date.now() + 3600 * 1000 * 80
  },
  {
    id: "vip-2",
    plan: "vip",
    color: "#047857",
    category: "oferta",
    author: "Tostaduría Villa Rica - Oxa",
    title: "Café de Especialidad Molido al Instante — S/ 18",
    content: "Presentación de 250g tueste medio. Visítanos a dos cuadras de la Plaza de Armas.",
    contact: "999888777",
    link: "",
    mediaType: null,
    mediaUrl: null,
    status: "approved",
    reports: 0,
    createdAt: Date.now() - 3600 * 1000 * 10,
    expiresAt: Date.now() + 3600 * 1000 * 74
  },
  {
    id: "com-1",
    plan: "gratis",
    color: null,
    category: "aviso",
    author: "Pichanga Maracaná",
    title: "Faltan 2 jugadores para 6v6 hoy 8:00 PM",
    content: "Cancha sintética Maracaná. Cuota dividida entre todos, nivel parejo.",
    contact: "987654321",
    link: "",
    mediaType: null,
    mediaUrl: null,
    status: "approved",
    reports: 0,
    createdAt: Date.now() - 3600 * 1000 * 2,
    expiresAt: Date.now() + 3600 * 1000 * 22
  },
  {
    id: "com-2",
    plan: "gratis",
    color: null,
    category: "humor",
    author: "Vecino del Centro",
    title: "Clima oficial de Oxapampa",
    content: "Sales con sol radiante, a las dos cuadras te cae diluvio y regresas a casa con arcoíris.",
    contact: "",
    link: "",
    mediaType: null,
    mediaUrl: null,
    status: "approved",
    reports: 0,
    createdAt: Date.now() - 3600 * 1000 * 5,
    expiresAt: Date.now() + 3600 * 1000 * 19
  }
];

let notes = JSON.parse(localStorage.getItem("mural_oxa_notes")) || INITIAL_NOTES;
let isAdmin = sessionStorage.getItem("mural_oxa_admin") === "true";
let currentFilter = "todos";

// Referencias DOM
const vipGrid = document.getElementById("vipGrid");
const communityGrid = document.getElementById("communityGrid");
const pendingGrid = document.getElementById("pendingGrid");
const pendingSection = document.getElementById("pendingSection");
const pendingCount = document.getElementById("pendingCount");
const adminBar = document.getElementById("adminBar");
const btnAdminToggle = document.getElementById("btnAdminToggle");

// Modales
const publishModal = document.getElementById("publishModal");
const adminModal = document.getElementById("adminModal");
const publishForm = document.getElementById("publishForm");
const vipOptions = document.getElementById("vipOptions");

function saveNotes() {
  localStorage.setItem("mural_oxa_notes", JSON.stringify(notes));
}

// Carga publicaciones compartidas desde Supabase.
// La tabla guarda cada publicación completa en la columna JSONB "data".
async function loadNotesFromSupabase() {
  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .select("data")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Supabase: no se pudieron cargar las publicaciones:", error.message);
    return;
  }

  if (Array.isArray(data) && data.length) {
    const remoteNotes = data.map((row) => row.data).filter(Boolean);
    const localOnly = notes.filter((local) =>
      !remoteNotes.some((remote) => remote.id === local.id)
    );
    notes = [...remoteNotes, ...localOnly].sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
    saveNotes();
    renderAll();
  }
}

// Guarda una nueva publicación en la base de datos compartida.
async function saveNoteToSupabase(note) {
  const { error } = await supabaseClient
    .from(SUPABASE_TABLE)
    .insert({ id: note.id, data: note });

  if (error) {
    console.error("Supabase: no se pudo guardar la publicación:", error.message);
    alert("La publicación quedó guardada en este dispositivo, pero no se pudo sincronizar con Supabase. Revisa la tabla y las políticas RLS.");
    return false;
  }
  return true;
}

function getRemainingTime(expiresAt) {
  const diff = expiresAt - Date.now();
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m restantes` : `${mins}m restantes`;
}

function renderMedia(note) {
  if (!note.mediaUrl) return "";
  if (note.mediaType === "image") {
    return `<div class="card-media"><img src="${note.mediaUrl}" alt="Adjunto"></div>`;
  }
  if (note.mediaType === "audio") {
    return `<div class="card-media"><audio controls src="${note.mediaUrl}"></audio></div>`;
  }
  if (note.mediaType === "video") {
    return `<div class="card-media"><video controls src="${note.mediaUrl}"></video></div>`;
  }
  return "";
}

function createCardHTML(note, isPendingView = false) {
  const isVip = note.plan === "vip";
  const cardClass = isVip ? "vip-card" : "note-card";
  const borderStyle = isVip ? `style="border-left-color: ${note.color || "#b91c1c"};"` : "";

  const whatsappBtn = note.contact
    ? `<a class="action-link action-whatsapp" href="https://wa.me/51${note.contact.replace(/\D/g, "")}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`
    : "";

  const linkHtml = note.link
    ? `<a class="external-link" href="${escapeAttribute(note.link)}" target="_blank" rel="noopener noreferrer">Abrir enlace adjunto</a>`
    : "";

  const adminButtons = isAdmin
    ? `<div class="admin-controls">
        ${isPendingView ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="approveNote('${note.id}')">Aprobar y Publicar</button>` : ""}
        <button class="btn btn-danger-sm" onclick="deleteNote('${note.id}')">Eliminar</button>
       </div>`
    : "";

  return `
    <article class="${cardClass}" ${borderStyle}>
      <div>
        <div class="card-top">
          <span class="cat-tag">${isVip ? "ESPACIO FIJO · " : ""}${escapeHTML(note.category)}</span>
          <span>${getRemainingTime(note.expiresAt)}</span>
        </div>
        <h3 class="card-title">${escapeHTML(note.title)}</h3>
        <p class="card-body">${escapeHTML(note.content)}</p>
      </div>
      ${renderMedia(note)}
      ${linkHtml}
      <div>
        <div class="card-footer">
          <span>Por: <strong>${escapeHTML(note.author)}</strong></span>
          <div class="card-actions">
            ${whatsappBtn}
            ${!isPendingView ? `<button class="action-link" onclick="reportNote('${note.id}')">Reportar</button>` : ""}
          </div>
        </div>
        ${adminButtons}
      </div>
    </article>
  `;
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function escapeAttribute(str) {
  return escapeHTML(str).replace(/\x60/g, "&#96;");
}

function renderAll() {
  const now = Date.now();
  notes = notes.filter((n) => n.expiresAt > now);
  saveNotes();

  if (isAdmin) {
    adminBar.classList.remove("hidden");
    btnAdminToggle.textContent = "Admin Activo";
  } else {
    adminBar.classList.add("hidden");
    btnAdminToggle.textContent = "Acceso Admin";
  }

  const vipNotes = notes.filter((n) => n.plan === "vip" && n.status === "approved");
  vipGrid.innerHTML = vipNotes.length
    ? vipNotes.map((n) => createCardHTML(n)).join("")
    : `<p class="section-desc">No hay espacios fijos activos en este momento. Reserva el tuyo por S/ 5.</p>`;

  const commNotes = notes.filter((n) => {
    const matchesStatus = n.plan === "gratis" && n.status === "approved";
    const matchesFilter = currentFilter === "todos" || n.category === currentFilter;
    return matchesStatus && matchesFilter;
  });

  communityGrid.innerHTML = commNotes.length
    ? commNotes.map((n) => createCardHTML(n)).join("")
    : `<p class="section-desc">Aún no hay publicaciones en esta categoría.</p>`;

  const pendingNotes = notes.filter((n) => n.status === "pending");
  pendingCount.textContent = `${pendingNotes.length} pendientes de revisión`;

  if (isAdmin && pendingNotes.length > 0) {
    pendingSection.classList.remove("hidden");
    pendingGrid.innerHTML = pendingNotes.map((n) => createCardHTML(n, true)).join("");
  } else {
    pendingSection.classList.add("hidden");
    pendingGrid.innerHTML = "";
  }
}

// Acciones de Moderación
window.deleteNote = function (id) {
  notes = notes.filter((n) => n.id !== id);
  saveNotes();
  renderAll();
};

window.approveNote = function (id) {
  const note = notes.find((n) => n.id === id);
  if (note) {
    note.status = "approved";
    if (note.plan === "vip") {
      note.expiresAt = Date.now() + 84 * 60 * 60 * 1000;
    }
    saveNotes();
    renderAll();
  }
};

window.reportNote = function (id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  note.reports = (note.reports || 0) + 1;
  if (note.reports >= 3) {
    note.status = "pending";
    alert("La publicación recibió 3 reportes y fue ocultada para revisión del administrador.");
  } else {
    alert("Reporte registrado. A los 3 reportes se oculta automáticamente.");
  }
  saveNotes();
  renderAll();
};

// Eventos de Modal Publicación
document.getElementById("btnOpenModal").addEventListener("click", () => {
  publishModal.classList.remove("hidden");
});

document.getElementById("btnOpenVipModal").addEventListener("click", () => {
  publishModal.classList.remove("hidden");
  document.querySelector('input[name="plan"][value="vip"]').checked = true;
  vipOptions.classList.remove("hidden");
});

document.getElementById("btnCloseModal").addEventListener("click", () => publishModal.classList.add("hidden"));
document.getElementById("btnCancelModal").addEventListener("click", () => publishModal.classList.add("hidden"));

document.querySelectorAll('input[name="plan"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    vipOptions.classList.toggle("hidden", e.target.value !== "vip");
  });
});

// Envío del Formulario
publishForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const plan = document.querySelector('input[name="plan"]:checked').value;
  const vipColor = document.querySelector('input[name="vipColor"]:checked')?.value || "#b91c1c";
  const category = document.getElementById("noteCategory").value;
  const author = document.getElementById("noteAuthor").value.trim();
  const title = document.getElementById("noteTitle").value.trim();
  const content = document.getElementById("noteContent").value.trim();
  const contact = document.getElementById("noteContact").value.trim();
  const link = document.getElementById("noteLink").value.trim();
  const file = document.getElementById("noteMedia").files[0];

  if (link && !/^https?:\/\//i.test(link)) {
    alert("El enlace debe comenzar con http:// o https://");
    return;
  }

  const durationHours = plan === "vip" ? 84 : 24;
  const requiresApproval = plan === "vip" || Boolean(file);

  const finalizeNote = (mediaType, mediaUrl) => {
    const newNote = {
      id: "note-" + Date.now(),
      plan,
      color: plan === "vip" ? vipColor : null,
      category,
      author,
      title,
      content,
      contact,
      link,
      mediaType,
      mediaUrl,
      status: requiresApproval ? "pending" : "approved",
      reports: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationHours * 60 * 60 * 1000
    };

    notes.unshift(newNote);
    saveNotes();
    saveNoteToSupabase(newNote);
    publishForm.reset();
    vipOptions.classList.add("hidden");
    publishModal.classList.add("hidden");
    renderAll();

    if (requiresApproval) {
      alert("Tu nota fue enviada a revisión del administrador (para validar pago S/ 5 o archivo multimedia).");
    }
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      let type = "image";
      if (file.type.startsWith("audio/")) type = "audio";
      else if (file.type.startsWith("video/")) type = "video";
      finalizeNote(type, ev.target.result);
    };
    reader.onerror = () => alert("No se pudo leer el archivo adjunto. Intenta nuevamente.");
    reader.readAsDataURL(file);
  } else {
    finalizeNote(null, null);
  }
});

// Filtros
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderAll();
  });
});

// Login Admin
btnAdminToggle.addEventListener("click", () => {
  if (!isAdmin) adminModal.classList.remove("hidden");
});

document.getElementById("btnCloseAdminModal").addEventListener("click", () => {
  adminModal.classList.add("hidden");
});

document.getElementById("adminLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const pass = document.getElementById("adminPassword").value;
  if (pass === "admin123") {
    isAdmin = true;
    sessionStorage.setItem("mural_oxa_admin", "true");
    adminModal.classList.add("hidden");
    document.getElementById("adminPassword").value = "";
    renderAll();
  } else {
    alert("Clave incorrecta.");
  }
});

document.getElementById("btnLogoutAdmin").addEventListener("click", () => {
  isAdmin = false;
  sessionStorage.removeItem("mural_oxa_admin");
  renderAll();
});

// Inicializar la interfaz y sincronizar publicaciones compartidas.
renderAll();
loadNotesFromSupabase();
