// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = "https://sfdotyphtudkuomltxht.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ea8h4bdeQBYuL0bNtdP3Ww_DQ-kGdQF";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let notes = [];
let isAdmin = false;
let currentFilter = "todos";

// Referencias DOM
const vipGrid = document.getElementById("vipGrid");
const communityGrid = document.getElementById("communityGrid");
const pendingGrid = document.getElementById("pendingGrid");
const pendingSection = document.getElementById("pendingSection");
const pendingCount = document.getElementById("pendingCount");
const adminBar = document.getElementById("adminBar");
const btnAdminToggle = document.getElementById("btnAdminToggle");

const publishModal = document.getElementById("publishModal");
const adminModal = document.getElementById("adminModal");
const publishForm = document.getElementById("publishForm");
const vipOptions = document.getElementById("vipOptions");

// Verificar si ya hay sesión de administrador activa
async function checkAdminSession() {
  const { data: { session } } = await db.auth.getSession();
  isAdmin = Boolean(session);
  updateAdminUI();
}

function updateAdminUI() {
  if (isAdmin) {
    adminBar.classList.remove("hidden");
    btnAdminToggle.textContent = "Admin Activo";
  } else {
    adminBar.classList.add("hidden");
    btnAdminToggle.textContent = "Acceso Admin";
  }
}

// Cargar notas desde Supabase
async function fetchNotes() {
  const nowISO = new Date().toISOString();

  const { data, error } = await db
    .from("notes")
    .select("*")
    .gt("expires_at", nowISO)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error cargando notas:", error);
    return;
  }

  notes = data || [];
  renderAll();
}

function getRemainingTime(expiresAt) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return hours > 0 ? `${hours}h ${mins}m restantes` : `${mins}m restantes`;
}

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function renderMedia(note) {
  if (!note.media_url) return "";
  if (note.media_type === "image") {
    return `<div class="card-media"><img src="${note.media_url}" alt="Adjunto" loading="lazy"></div>`;
  }
  if (note.media_type === "audio") {
    return `<div class="card-media"><audio controls src="${note.media_url}"></audio></div>`;
  }
  if (note.media_type === "video") {
    return `<div class="card-media"><video controls src="${note.media_url}"></video></div>`;
  }
  return "";
}

function createCardHTML(note, isPendingView = false) {
  const isVip = note.plan === "vip";
  const cardClass = isVip ? "vip-card" : "note-card";
  const borderStyle = isVip ? `style="border-left-color: ${note.color || "#b91c1c"};"` : "";

  const whatsappBtn = note.contact
    ? `<a class="action-link action-whatsapp" href="https://wa.me/51${note.contact.replace(/\D/g, "")}" target="_blank">WhatsApp</a>`
    : "";

  const linkHtml = note.link
    ? `<a class="external-link" href="${escapeHTML(note.link)}" target="_blank">Abrir enlace adjunto</a>`
    : "";

  const adminButtons = isAdmin
    ? `<div class="admin-controls">
        ${isPendingView ? `<button class="btn btn-primary" style="padding:4px 10px;font-size:0.75rem;" onclick="approveNote('${note.id}', '${note.plan}')">Aprobar y Publicar</button>` : ""}
        <button class="btn btn-danger-sm" onclick="deleteNote('${note.id}', '${note.media_url || ""}')">Eliminar</button>
       </div>`
    : "";

  return `
    <article class="${cardClass}" ${borderStyle}>
      <div>
        <div class="card-top">
          <span class="cat-tag">${isVip ? "ESPACIO FIJO · " : ""}${escapeHTML(note.category)}</span>
          <span>${getRemainingTime(note.expires_at)}</span>
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
            ${!isPendingView ? `<button class="action-link" onclick="reportNote('${note.id}', ${note.reports || 0})">Reportar</button>` : ""}
          </div>
        </div>
        ${adminButtons}
      </div>
    </article>
  `;
}

function renderAll() {
  updateAdminUI();

  // VIP Aprobados
  const vipNotes = notes.filter((n) => n.plan === "vip" && n.status === "approved");
  vipGrid.innerHTML = vipNotes.length
    ? vipNotes.map((n) => createCardHTML(n)).join("")
    : `<p class="section-desc">No hay espacios fijos activos en este momento. Reserva el tuyo por S/ 5.</p>`;

  // Comunitarios Aprobados
  const commNotes = notes.filter((n) => {
    const matchesStatus = n.plan === "gratis" && n.status === "approved";
    const matchesFilter = currentFilter === "todos" || n.category === currentFilter;
    return matchesStatus && matchesFilter;
  });

  communityGrid.innerHTML = commNotes.length
    ? commNotes.map((n) => createCardHTML(n)).join("")
    : `<p class="section-desc">Aún no hay publicaciones en esta categoría.</p>`;

  // Cola de Revisión (Solo Admin)
  const pendingNotes = notes.filter((n) => n.status === "pending");
  pendingCount.textContent = `${pendingNotes.length} pendientes de revisión`;

  if (isAdmin && pendingNotes.length > 0) {
    pendingSection.classList.remove("hidden");
    pendingGrid.innerHTML = pendingNotes.map((n) => createCardHTML(n, true)).join("");
  } else {
    pendingSection.classList.add("hidden");
  }
}

// ==========================================
// ACCIONES DE ADMINISTRADOR Y REPORTES
// ==========================================
window.deleteNote = async function (id, mediaUrl) {
  if (!isAdmin) return;
  if (!confirm("¿Eliminar esta publicación permanentemente?")) return;

  if (mediaUrl) {
    const fileName = mediaUrl.split("/").pop();
    await db.storage.from("mural-media").remove([fileName]);
  }

  const { error } = await db.from("notes").delete().eq("id", id);
  if (!error) fetchNotes();
};

window.approveNote = async function (id, plan) {
  if (!isAdmin) return;
  const updates = { status: "approved" };

  if (plan === "vip") {
    updates.expires_at = new Date(Date.now() + 84 * 60 * 60 * 1000).toISOString();
  }

  const { error } = await db.from("notes").update(updates).eq("id", id);
  if (!error) fetchNotes();
};

window.reportNote = async function (id, currentReports) {
  const newReports = (currentReports || 0) + 1;
  const updates = { reports: newReports };

  if (newReports >= 3) {
    updates.status = "pending";
  }

  const { error } = await db.from("notes").update(updates).eq("id", id);
  if (!error) {
    alert(
      newReports >= 3
        ? "La publicación recibió 3 reportes y fue ocultada para revisión del administrador."
        : "Reporte registrado."
    );
    fetchNotes();
  }
};

// ==========================================
// PUBLICAR NUEVA NOTA + SUBIDA MULTIMEDIA
// ==========================================
publishForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = publishForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "Publicando...";

  try {
    const plan = document.querySelector('input[name="plan"]:checked').value;
    const vipColor = document.querySelector('input[name="vipColor"]:checked')?.value || "#b91c1c";
    const category = document.getElementById("noteCategory").value;
    const author = document.getElementById("noteAuthor").value.trim();
    const title = document.getElementById("noteTitle").value.trim();
    const content = document.getElementById("noteContent").value.trim();
    const contact = document.getElementById("noteContact").value.trim();
    const link = document.getElementById("noteLink").value.trim();
    const file = document.getElementById("noteMedia").files[0];

    if (file && file.size > 20 * 1024 * 1024) {
      alert("El archivo supera los 20 MB. Para videos o música pesada, pega un enlace de YouTube o Drive.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Publicar en el Mural";
      return;
    }

    let mediaType = null;
    let mediaUrl = null;

    if (file) {
      if (file.type.startsWith("image/")) mediaType = "image";
      else if (file.type.startsWith("audio/")) mediaType = "audio";
      else if (file.type.startsWith("video/")) mediaType = "video";

      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      const { error: uploadError } = await db.storage
        .from("mural-media")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = db.storage
        .from("mural-media")
        .getPublicUrl(fileName);

      mediaUrl = publicUrlData.publicUrl;
    }

    const durationHours = plan === "vip" ? 84 : 24;
    const requiresApproval = plan === "vip" || Boolean(file);

    const { error: insertError } = await db.from("notes").insert([
      {
        plan,
        color: plan === "vip" ? vipColor : null,
        category,
        author,
        title,
        content,
        contact,
        link,
        media_type: mediaType,
        media_url: mediaUrl,
        status: requiresApproval ? "pending" : "approved",
        expires_at: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      }
    ]);

    if (insertError) throw insertError;

    publishForm.reset();
    vipOptions.classList.add("hidden");
    publishModal.classList.add("hidden");
    await fetchNotes();

    if (requiresApproval) {
      alert("Tu nota fue enviada a revisión del administrador (validación de pago S/ 5 o archivo multimedia).");
    }
  } catch (err) {
    console.error(err);
    alert("Hubo un error al publicar. Revisa tu conexión o la configuración de Supabase.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Publicar en el Mural";
  }
});

// ==========================================
// EVENTOS DE INTERFAZ Y LOGIN ADMIN
// ==========================================
document.getElementById("btnOpenModal").addEventListener("click", () => publishModal.classList.remove("hidden"));
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

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderAll();
  });
});

btnAdminToggle.addEventListener("click", () => {
  if (!isAdmin) adminModal.classList.remove("hidden");
});
document.getElementById("btnCloseAdminModal").addEventListener("click", () => adminModal.classList.add("hidden"));

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    alert("Credenciales incorrectas.");
  } else {
    isAdmin = true;
    adminModal.classList.add("hidden");
    document.getElementById("adminLoginForm").reset();
    await fetchNotes();
  }
});

document.getElementById("btnLogoutAdmin").addEventListener("click", async () => {
  await db.auth.signOut();
  isAdmin = false;
  await fetchNotes();
});

// Tiempo real
db.channel("mural-realtime")
  .on("postgres_changes", { event: "*", schema: "public", table: "notes" }, () => {
    fetchNotes();
  })
  .subscribe();

// Arrancar aplicación
(async function init() {
  await checkAdminSession();
  await fetchNotes();
})();