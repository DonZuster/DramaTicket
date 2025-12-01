// ========================================
//  ADMIN.JS - Panel de Administración
//  - Gestión de eventos (CRUD + asientos)
//  - Gestión de usuarios
//  - Estadísticas / analíticas
//  - Subida de imágenes a Firebase Storage
// ========================================

// ------------------------
// Importaciones Firebase
// ------------------------
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

import {
  formatTimestamp,
  showToast,
  showGenericMessageModal
} from "./utils.js";

// UID del administrador (debe coincidir con el UID real de tu usuario admin)
const ADMIN_UID = "poQqw14QiYVb2Y05vQKS5dPLsPE2";

// URL de la API de IA (FastAPI)
const PREDICTION_API_URL = "https://dramaticket-ia.onrender.com/predict";


// ===================
//  CONFIG AUDIT LOG
// ===================
const AUDIT_LOG_COLLECTION = "auditLog";

/**
 * Registra acciones administrativas en la colección 'auditLog'.
 * @param {string} action   Código corto de la acción (p.ej. 'EVENT_CREATE')
 * @param {object} payload  Datos adicionales (campo libre)
 */
async function logAdminAction(action, payload = {}) {
  try {
    if (!window.db || !currentAuthUser) {
      return; // si no hay admin autenticado, no logueamos
    }

    const logData = {
      action,                          // p.ej. 'EVENT_CREATE'
      userId: currentAuthUser.uid,
      userEmail: currentAuthUser.email || null,
      occurredAt: new Date(),          // timestamp de la acción
      ...payload                       // datos extra (id evento, etc.)
    };

    await addDoc(collection(window.db, AUDIT_LOG_COLLECTION), logData);
  } catch (error) {
    console.error("Error al registrar acción en auditLog:", error);
    // No hacemos showToast: un fallo del log no debe romper la acción principal
  }
}


// ========================================
//  VARIABLES DEL DOM
// ========================================

// --- Autenticación / Header ---
let authStatusMessage;
let adminUserIdDisplay;
let signOutBtn;

// --- Pestañas ---
let tabEventsBtn;
let tabUsersBtn;
let tabStatisticsBtn;
let eventsTabContent;
let usersTabContent;
let statisticsTabContent;

// --- Formulario de Eventos ---
let eventForm;
let eventIdInput;
let eventTituloInput;
let eventGeneroInput;
let eventLugarInput;
let eventFechaInput;
let eventPrecioInput;
let eventImagenUrlInput;
let eventImagenFileInput;
let eventImagePreview;
let eventImagePlaceholder;
let eventDescripcionInput;
let cancelEditBtn;
let saveEventBtn;
let editFieldButtons;

// --- Modales (precio) ---
let priceJustificationModal;
let justificationTextarea;
let submitJustificationBtn;
let cancelJustificationBtn;

// --- Modal edición de usuario ---
let editUserModal;
let editUserForm;
let editUserIdInput;
let editUserNameInput;
let editUserEmailInput;
let cancelEditUserBtn;

// --- Tablas (Eventos / Usuarios / Stats) ---
let adminEventTableBody;
let adminEventTableHead;
let noFilteredEventsMessage;

let adminUserTableBody;
let adminUserTableHead;
let noFilteredUsersMessage;

let statTotalEvents;
let statTotalUsers;
let statTicketsSold;
let statTotalRevenue;
let statTopEventsTableBody;
let noTopEventsMessage;

// ======== Gráficos (Chart.js) ========
let ticketsByEventChart = null;
let revenueByMonthChart = null;

// Exportación de compras (CSV)
let exportPurchasesBtn;      // NUEVO
let exportPurchasesStatus;   // NUEVO

// ========================================
//  ESTADO GLOBAL
// ========================================
let currentEditingEventId = null;
let currentAuthUser = null;
let originalEventData = null;

let allEventsData = [];
let allUsersData = [];

let currentEventSortColumn = "titulo";
let currentEventSortDirection = "asc";

let currentUserSortColumn = "registeredAt";
let currentUserSortDirection = "asc";

// ========================================
//  INICIALIZACIÓN
// ========================================
document.addEventListener("DOMContentLoaded", () => {
  const checkReady = setInterval(() => {
    if (
      typeof window.auth !== "undefined" &&
      typeof window.db !== "undefined" &&
      typeof window.storage !== "undefined" &&
      typeof window.appId !== "undefined" &&
      document.getElementById("tab-events")
    ) {
      clearInterval(checkReady);
      console.log(
        "admin.js: Firebase (Auth/DB/Storage) y DOM listos. Inicializando panel..."
      );
      initializeAdminPanel();
    } else {
      console.warn(
        "admin.js: Esperando a que Firebase o el DOM estén listos..."
      );
    }
  }, 100);
});

function initializeAdminPanel() {
  // ------- Referencias DOM -------
  authStatusMessage = document.getElementById("auth-status-message");
  adminUserIdDisplay = document.getElementById("admin-user-id");
  signOutBtn = document.getElementById("sign-out-btn");

  tabEventsBtn = document.getElementById("tab-events");
  tabUsersBtn = document.getElementById("tab-users");
  tabStatisticsBtn = document.getElementById("tab-statistics");
  eventsTabContent = document.getElementById("events-tab-content");
  usersTabContent = document.getElementById("users-tab-content");
  statisticsTabContent = document.getElementById("statistics-tab-content");

  eventForm = document.getElementById("event-form");
  eventIdInput = document.getElementById("event-id");
  eventTituloInput = document.getElementById("event-titulo");
  eventGeneroInput = document.getElementById("event-genero");
  eventLugarInput = document.getElementById("event-lugar");
  eventFechaInput = document.getElementById("event-fecha");
  eventPrecioInput = document.getElementById("event-precio");
  eventImagenUrlInput = document.getElementById("event-imagen-url");
  eventImagenFileInput = document.getElementById("event-imagen-file");
  eventImagePreview = document
    .getElementById("event-image-preview")
    .querySelector("img");
  eventImagePlaceholder = document
    .getElementById("event-image-preview")
    .querySelector(".text-placeholder");
  eventDescripcionInput = document.getElementById("event-descripcion");
  cancelEditBtn = document.getElementById("cancel-edit-btn");
  saveEventBtn = eventForm
    ? eventForm.querySelector('button[type="submit"]')
    : null;
  editFieldButtons = document.querySelectorAll(
    ".input-group-admin .btn-edit-field"
  );

  priceJustificationModal = document.getElementById(
    "price-justification-modal"
  );
  justificationTextarea = document.getElementById("justification-textarea");
  submitJustificationBtn = document.getElementById("submit-justification-btn");
  cancelJustificationBtn = document.getElementById("cancel-justification-btn");

  adminEventTableBody = document.getElementById("admin-event-table-body");
  adminEventTableHead = document.querySelector("#admin-event-table thead");
  noFilteredEventsMessage = document.getElementById(
    "no-filtered-events-message"
  );

  adminUserTableBody = document.getElementById("admin-user-table-body");
  adminUserTableHead = document.querySelector("#admin-user-table thead");
  noFilteredUsersMessage = document.getElementById(
    "no-filtered-users-message"
  );

  editUserModal = document.getElementById("edit-user-modal");
  editUserForm = document.getElementById("edit-user-form");
  editUserIdInput = document.getElementById("edit-user-id");
  editUserNameInput = document.getElementById("edit-user-name");
  editUserEmailInput = document.getElementById("edit-user-email");
  cancelEditUserBtn = document.getElementById("cancel-edit-user-btn");

  statTotalEvents = document.getElementById("stat-total-events");
  statTotalUsers = document.getElementById("stat-total-users");
  statTicketsSold = document.getElementById("stat-tickets-sold");
  statTotalRevenue = document.getElementById("stat-total-revenue");
  statTopEventsTableBody = document.querySelector(
    "#stat-top-events-table tbody"
  );
  noTopEventsMessage = document.getElementById("no-top-events-message");

  // Botón y texto de exportación de compras
  exportPurchasesBtn = document.getElementById('btn-export-purchases');      // NUEVO
  exportPurchasesStatus = document.getElementById('export-purchases-status'); // NUEVO


  // ------- Auth listener -------
  onAuthStateChanged(window.auth, (user) => {
    currentAuthUser = user;

    if (user) {
      adminUserIdDisplay.textContent = `UID: ${user.uid}`;
      signOutBtn.style.display = "block";

      if (user.uid === ADMIN_UID) {
        authStatusMessage.textContent = `Bienvenido, ${user.email || "Administrador"
          }.`;
        authStatusMessage.classList.remove(
          "info-message",
          "error-message"
        );
        authStatusMessage.classList.add("success-message");

        setupEventListeners();
        switchTab("events");
      } else {
        // Usuario autenticado pero no admin
        authStatusMessage.textContent =
          "Acceso Denegado: No tienes permisos de administrador.";
        authStatusMessage.classList.remove(
          "success-message",
          "info-message"
        );
        authStatusMessage.classList.add("error-message");

        hideAdminUI();

        if (window.location.pathname.includes("admin.html")) {
          showGenericMessageModal(
            "Acceso Denegado",
            "Solo los administradores tienen acceso a este panel.",
            true,
            "Ir a Inicio",
            "Cerrar"
          ).then((confirmed) => {
            window.location.href = confirmed ? "index.html" : "index.html";
          });
        }
      }
    } else {
      // No autenticado
      authStatusMessage.textContent =
        "Inicia sesión para acceder al panel de administración.";
      authStatusMessage.classList.remove(
        "success-message",
        "error-message"
      );
      authStatusMessage.classList.add("info-message");
      adminUserIdDisplay.textContent = "";
      signOutBtn.style.display = "none";

      hideAdminUI();

      const currentPath = window.location.pathname.split("/").pop();
      const protectedPages = [
        "admin.html",
        "my-account.html",
        "payment-details.html",
        "confirmacion.html"
      ];
      if (
        protectedPages.includes(currentPath) &&
        currentPath !== "login.html" &&
        currentPath !== "register.html"
      ) {
        showGenericMessageModal(
          "Acceso Restringido",
          "Necesitas iniciar sesión para acceder a esta página.",
          true,
          "Ir a Login",
          "Cerrar"
        ).then((confirmed) => {
          window.location.href = confirmed ? "login.html" : "index.html";
        });
      }
    }
  });

  // Dejar el formulario en estado inicial
  resetEventForm();
}

function hideAdminUI() {
  if (eventsTabContent) eventsTabContent.style.display = "none";
  if (usersTabContent) usersTabContent.style.display = "none";
  if (statisticsTabContent) statisticsTabContent.style.display = "none";
  if (tabEventsBtn) tabEventsBtn.style.display = "none";
  if (tabUsersBtn) tabUsersBtn.style.display = "none";
  if (tabStatisticsBtn) tabStatisticsBtn.style.display = "none";
}

// ========================================
//  EVENT LISTENERS
// ========================================
function setupEventListeners() {

  // --- Pestañas (Eventos / Usuarios / Estadísticas) ---
  if (tabEventsBtn) {
    tabEventsBtn.addEventListener('click', () => switchTab('events'));
  }
  if (tabUsersBtn) {
    tabUsersBtn.addEventListener('click', () => switchTab('users'));
  }
  if (tabStatisticsBtn) {
    tabStatisticsBtn.addEventListener('click', () => switchTab('statistics'));
  }

  // Manejador del formulario de eventos
  if (eventForm) eventForm.addEventListener('submit', handleEventFormSubmit);

  // Botón para exportar todas las compras a CSV
  if (exportPurchasesBtn) {
    exportPurchasesBtn.addEventListener('click', exportAllPurchasesToCSV); // NUEVO
  }



  // Botones editar campo (lápiz / candado)
  if (editFieldButtons) {
    editFieldButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const inputField = e.currentTarget.previousElementSibling;
        if (!inputField) return;

        const nowDisabled = !inputField.disabled;
        inputField.disabled = nowDisabled;
        inputField.classList.toggle("input-locked", nowDisabled);

        const icon = e.currentTarget.querySelector("i");
        if (icon) {
          icon.classList.remove("fa-edit", "fa-lock-open");
          icon.classList.add(nowDisabled ? "fa-edit" : "fa-lock-open");
        }
        if (!nowDisabled) inputField.focus();
      });
    });
  }

  // Cancelar edición
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener("click", () => {
      resetEventForm();
      currentEditingEventId = null;
      if (saveEventBtn) saveEventBtn.textContent = "Guardar Evento";
      showToast("Edición de evento cancelada.", "info");
    });
  }

  // Cerrar sesión
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      try {
        await signOut(window.auth);
        console.log("Sesión cerrada desde admin.html.");
        window.location.href = "index.html";
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showToast("Error al cerrar sesión: " + error.message, "error");
      }
    });
  }

  // Preview imagen al seleccionar archivo
  if (eventImagenFileInput) {
    eventImagenFileInput.addEventListener("change", () => {
      const file = eventImagenFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (eventImagePreview) {
          eventImagePreview.src = ev.target.result;
          eventImagePreview.style.display = "block";
        }
        if (eventImagePlaceholder) {
          eventImagePlaceholder.style.display = "none";
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Actualizar preview si cambia URL manualmente (por si en algún momento lo usas)
  if (eventImagenUrlInput) {
    eventImagenUrlInput.addEventListener("input", () => {
      const imageUrl = eventImagenUrlInput.value.trim();
      if (imageUrl) {
        eventImagePreview.src = imageUrl;
        eventImagePreview.style.display = "block";
        eventImagePlaceholder.style.display = "none";
      } else {
        eventImagePreview.src = "";
        eventImagePreview.style.display = "none";
        eventImagePlaceholder.style.display = "block";
      }
    });
  }

  // Sort tabla eventos
  if (adminEventTableHead) {
    adminEventTableHead.querySelectorAll("th[data-sort]").forEach((header) => {
      header.style.cursor = "pointer";
      header.addEventListener("click", () => {
        const column = header.dataset.sort;
        if (currentEventSortColumn === column) {
          currentEventSortDirection =
            currentEventSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentEventSortColumn = column;
          currentEventSortDirection = "asc";
        }
        updateEventSortIcons();
        renderEventsTable(allEventsData);
      });
    });
  }

  // Sort tabla usuarios
  if (adminUserTableHead) {
    adminUserTableHead.querySelectorAll("th[data-sort]").forEach((header) => {
      header.style.cursor = "pointer";
      header.addEventListener("click", () => {
        const column = header.dataset.sort;
        if (currentUserSortColumn === column) {
          currentUserSortDirection =
            currentUserSortDirection === "asc" ? "desc" : "asc";
        } else {
          currentUserSortColumn = column;
          currentUserSortDirection = "asc";
        }
        updateUserSortIcons();
        renderUsersTable(allUsersData);
      });
    });
  }

  // Modal editar usuario
  if (editUserForm) {
    editUserForm.addEventListener("submit", handleEditUserFormSubmit);
  }
  if (cancelEditUserBtn) {
    cancelEditUserBtn.addEventListener("click", () => {
      if (editUserModal) {
        editUserModal.classList.remove("flex");
        editUserModal.classList.add("hidden");
      }
      if (editUserForm) editUserForm.reset();
    });
  }
}

// ========================================
//  PESTAÑAS
// ========================================
function switchTab(tabId) {
  // Quitar "active" de todos los botones
  const tabButtons = document.querySelectorAll(".admin-tabs .tab-button");
  tabButtons.forEach((btn) => btn.classList.remove("active"));

  // Ocultar TODO el contenido de pestañas
  const tabContents = document.querySelectorAll(".admin-tab-content");
  tabContents.forEach((content) => {
    content.classList.remove("active");
    content.style.display = "none";
  });

  // Determinar qué sección mostrar
  let targetSection = null;

  if (tabId === "events") {
    if (tabEventsBtn) tabEventsBtn.classList.add("active");
    targetSection = eventsTabContent;
    loadEvents(); // Gestión de Eventos + Listado de Eventos
  } else if (tabId === "users") {
    if (tabUsersBtn) tabUsersBtn.classList.add("active");
    targetSection = usersTabContent;
    loadUsers(); // Solo Gestión de Usuarios
  } else if (tabId === "statistics") {
    if (tabStatisticsBtn) tabStatisticsBtn.classList.add("active");
    targetSection = statisticsTabContent;
    loadStatistics(); // Estadísticas Generales + Eventos con Más Ventas
  }

  // Mostrar solo la sección seleccionada
  if (targetSection) {
    targetSection.classList.add("active");
    targetSection.style.display = "block";
  }
}


/**
 * Llama al backend de IA para predecir la ocupación de un evento.
 * @param {Object} eventData - Debe tener: titulo, precio, fecha (Date)
 * @returns {Promise<number|null>} porcentaje de ocupación o null si falla
 */
async function predictEventOccupancy(eventData) {
  try {
    if (!eventData || !eventData.fecha || !eventData.titulo) {
      return null;
    }

    // Asegurar que la fecha es un objeto Date
    const fecha = eventData.fecha instanceof Date
      ? eventData.fecha
      : new Date(eventData.fecha);

    if (isNaN(fecha.getTime())) {
      return null;
    }

    // ISO sin milisegundos (ej: 2025-11-23T20:30:00)
    const fechaISO = fecha.toISOString().split(".")[0];

    const body = {
      titulo_evento: eventData.titulo || "",
      precio_unitario: Number(eventData.precio) || 0,
      fecha_evento_iso: fechaISO
    };

    const response = await fetch(PREDICTION_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error("Error en API IA:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    if (typeof data.ocupacion_predicha_pct !== "number") {
      return null;
    }

    return data.ocupacion_predicha_pct;
  } catch (error) {
    console.error("Error al predecir ocupación IA:", error);
    return null;
  }
}


// ========================================
//  EVENTOS - LISTADO Y TABLA
// ========================================
async function loadEvents() {
  if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
    console.error("No hay permisos de admin para cargar eventos.");
    if (adminEventTableBody) {
      adminEventTableBody.innerHTML =
        '<tr><td colspan="7" class="error-message active">Error: Firestore no disponible o sin permisos.</td></tr>';
    }
    return;
  }

  try {
    const eventsCol = collection(window.db, "eventos");
    const eventSnapshot = await getDocs(eventsCol);

    allEventsData = [];
    eventSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      allEventsData.push({
        id: docSnap.id,
        ...data,
        fecha:
          data.fecha && typeof data.fecha.toDate === "function"
            ? data.fecha.toDate()
            : null
      });
    });

    updateEventSortIcons();
    renderEventsTable(allEventsData);
  } catch (error) {
    console.error("Error al cargar eventos:", error);
    showGenericMessageModal(
      "Error al Cargar Eventos",
      "No se pudieron cargar los eventos: " + error.message,
      false
    );
    if (adminEventTableBody) {
      adminEventTableBody.innerHTML =
        '<tr><td colspan="7" class="error-message active">Error al cargar eventos.</td></tr>';
    }
  }
}

function updateEventSortIcons() {
  if (!adminEventTableHead) return;
  adminEventTableHead.querySelectorAll("th[data-sort]").forEach((header) => {
    const icon = header.querySelector("i.fas");
    if (!icon) return;
    icon.classList.remove("fa-sort-up", "fa-sort-down");
    icon.classList.add("fa-sort");

    if (header.dataset.sort === currentEventSortColumn) {
      icon.classList.remove("fa-sort");
      icon.classList.add(
        currentEventSortDirection === "asc" ? "fa-sort-up" : "fa-sort-down"
      );
    }
  });
}

function renderEventsTable(eventsData) {
  if (!adminEventTableBody) return;
  adminEventTableBody.innerHTML = "";

  const sortedEvents = [...eventsData].sort((a, b) => {
    let valA = a[currentEventSortColumn];
    let valB = b[currentEventSortColumn];

    if (currentEventSortColumn === "fecha") {
      valA = valA ? valA.getTime() : 0;
      valB = valB ? valB.getTime() : 0;
    } else if (currentEventSortColumn === "precio") {
      valA = parseFloat(valA) || 0;
      valB = parseFloat(valB) || 0;
    } else {
      valA = String(valA || "");
      valB = String(valB || "");
    }

    if (valA < valB) return currentEventSortDirection === "asc" ? -1 : 1;
    if (valA > valB) return currentEventSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (sortedEvents.length === 0) {
    if (noFilteredEventsMessage) noFilteredEventsMessage.style.display = "block";
    return;
  } else {
    if (noFilteredEventsMessage) noFilteredEventsMessage.style.display = "none";
  }

  sortedEvents.forEach((eventData) => {
    const row = adminEventTableBody.insertRow();
    row.dataset.id = eventData.id;

    const eventDateFormatted = eventData.fecha
      ? formatTimestamp(eventData.fecha)
      : "N/A";

    const imageUrl =
      eventData.imagen && eventData.imagen.trim() !== ""
        ? eventData.imagen
        : "https://placehold.co/80x80/cccccc/000000?text=No+Img";

    row.innerHTML = `
  <td data-label="Título">${eventData.titulo || "N/A"}</td>
  <td data-label="Género">${eventData.genero || "N/A"}</td>
  <td data-label="Lugar">${eventData.lugar || "N/A"}</td>
  <td data-label="Fecha">${eventDateFormatted}</td>
  <td data-label="Precio">CLP$${eventData.precio ? eventData.precio.toFixed(0) : "0"}</td>
  <td data-label="Imagen">
    <img src="${imageUrl}" alt="${eventData.titulo || "Evento"}"
         style="max-width: 80px; height: auto; border-radius: 4px;">
  </td>
  <!-- ⭐ Nueva celda para IA -->
  <td data-label="Ocupación IA" class="ia-cell">Calculando...</td>
  <td class="actions" data-label="Acciones">
    <div class="button-group-table">
      <button class="btn btn-edit btn-small" data-id="${eventData.id}">✏️ Editar</button>
      <button class="btn btn-delete btn-small" data-id="${eventData.id}">🗑️ Eliminar</button>
    </div>
  </td>
`;

    // Obtener referencia a la celda de IA
    const iaCell = row.querySelector(".ia-cell");

    // Llamar a la IA para este evento y actualizar la celda
    predictEventOccupancy(eventData).then((pred) => {
      if (!iaCell) return;
      if (pred === null) {
        iaCell.textContent = "N/D";
      } else {
        iaCell.textContent = `${pred.toFixed(1)}%`;
      }
    });

  });

  adminEventTableBody
    .querySelectorAll(".btn-edit")
    .forEach((button) =>
      button.addEventListener("click", (e) =>
        editEvent(e.currentTarget.dataset.id)
      )
    );

  adminEventTableBody
    .querySelectorAll(".btn-delete")
    .forEach((button) =>
      button.addEventListener("click", (e) =>
        deleteEvent(e.currentTarget.dataset.id)
      )
    );
}

// ========================================
//  EVENTOS - EDICIÓN Y GUARDADO
// ========================================
async function editEvent(eventId) {
  if (!window.db) {
    showToast("Error: Firestore no está inicializado.", "error");
    return;
  }

  try {
    const eventDocRef = doc(window.db, "eventos", eventId);
    const eventDoc = await getDoc(eventDocRef);

    if (!eventDoc.exists()) {
      showToast("Evento no encontrado para editar.", "error");
      resetEventForm();
      return;
    }

    const event = eventDoc.data();
    currentEditingEventId = eventId;
    originalEventData = { ...event };

    if (eventIdInput) eventIdInput.value = eventId;
    if (eventTituloInput) eventTituloInput.value = event.titulo || "";
    if (eventGeneroInput) eventGeneroInput.value = event.genero || "";
    if (eventLugarInput) eventLugarInput.value = event.lugar || "";

    if (eventFechaInput) {
      if (event.fecha && typeof event.fecha.toDate === "function") {
        const date = event.fecha.toDate();
        eventFechaInput.value = date.toISOString().slice(0, 16);
      } else {
        eventFechaInput.value = "";
      }
    }
    if (eventPrecioInput) eventPrecioInput.value = event.precio || 0;
    if (eventDescripcionInput)
      eventDescripcionInput.value = event.descripcion || "";

    if (eventImagenUrlInput) {
      eventImagenUrlInput.value = event.imagen || "";
    }

    if (event.imagen && event.imagen.trim() !== "") {
      eventImagePreview.src = event.imagen;
      eventImagePreview.style.display = "block";
      eventImagePlaceholder.style.display = "none";
    } else {
      eventImagePreview.src = "";
      eventImagePreview.style.display = "none";
      eventImagePlaceholder.style.display = "block";
    }

    if (saveEventBtn) saveEventBtn.textContent = "Actualizar Evento";

    // Desbloquear campos
    if (eventForm) {
      eventForm
        .querySelectorAll(".input-field-admin")
        .forEach((input) => {
          input.disabled = false;
          input.classList.remove("input-locked");
        });
      eventForm.querySelectorAll(".btn-edit-field").forEach((btn) => {
        const icon = btn.querySelector("i");
        if (icon) {
          icon.classList.remove("fa-edit");
          icon.classList.add("fa-lock-open");
        }
      });
    }

    showToast("Evento cargado para edición.", "info");
  } catch (error) {
    console.error("Error al cargar evento para edición:", error);
    showToast("Error al cargar el evento para edición: " + error.message, "error");
  }
}

async function handleEventFormSubmit(e) {
  e.preventDefault();

  if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
    showToast(
      "Error: No estás autenticado como administrador o Firebase no está listo.",
      "error"
    );
    return;
  }

  if (saveEventBtn) {
    saveEventBtn.disabled = true;
    saveEventBtn.textContent = "Guardando...";
  }

  const eventId = eventIdInput ? eventIdInput.value : "";
  const isEditing = !!eventId;

  const eventData = {
    titulo: eventTituloInput ? eventTituloInput.value.trim() : "",
    genero: eventGeneroInput ? eventGeneroInput.value.trim() : "",
    lugar: eventLugarInput ? eventLugarInput.value.trim() : "",
    fecha: eventFechaInput ? new Date(eventFechaInput.value) : null,
    precio: eventPrecioInput ? parseFloat(eventPrecioInput.value) : 0,
    descripcion: eventDescripcionInput
      ? eventDescripcionInput.value.trim()
      : ""
    // imagen se añadirá después de subirla
  };

  // Validaciones básicas
  if (isNaN(eventData.precio)) {
    showToast("El precio debe ser un número válido.", "error");
    restoreSaveButton(isEditing);
    return;
  }
  if (
    !eventData.titulo ||
    !eventData.genero ||
    !eventData.lugar ||
    !eventData.fecha ||
    !eventData.descripcion
  ) {
    showToast("Todos los campos obligatorios deben ser rellenados.", "error");
    restoreSaveButton(isEditing);
    return;
  }
  if (!eventData.fecha || isNaN(eventData.fecha.getTime())) {
    showToast("La fecha y hora no son válidas.", "error");
    restoreSaveButton(isEditing);
    return;
  }

  // Subida de imagen (si corresponde)
  let finalEventData = { ...eventData };
  try {
    const imageUrl = await uploadEventImageIfNeeded(eventData);
    finalEventData.imagen = imageUrl;
  } catch (uploadError) {
    console.error("Error al subir la imagen:", uploadError);
    showToast(
      "No se pudo subir la imagen del evento: " + uploadError.message,
      "error"
    );
    restoreSaveButton(isEditing);
    return;
  }

  // Justificación de cambio de precio
  const priceChanged =
    isEditing && originalEventData && originalEventData.precio !== eventData.precio;

  if (priceChanged) {
    const justification = await askForPriceJustification();
    if (!justification) {
      showToast(
        "Cambio de precio cancelado. Evento no guardado con nuevo precio.",
        "info"
      );
      if (
        originalEventData &&
        typeof originalEventData.precio !== "undefined" &&
        eventPrecioInput
      ) {
        eventPrecioInput.value = originalEventData.precio;
      }
      restoreSaveButton(isEditing);
      return;
    }
    finalEventData.priceChangeJustification = justification;
    finalEventData.lastPriceChangeBy = currentAuthUser.uid;
  } else if (isEditing) {
    delete finalEventData.priceChangeJustification;
    delete finalEventData.lastPriceChangeBy;
  }

  // Guardar en Firestore
  try {
    if (isEditing) {
      const eventDocRef = doc(window.db, "eventos", eventId);
      await updateDoc(eventDocRef, {
        ...finalEventData,
        updatedAt: new Date()
      });

      showToast("Evento actualizado con éxito.", "success");

      // Registrar en auditLog la actualización del evento
      const payload = {
        eventId: eventId,
        titulo: finalEventData.titulo || null,
        genero: finalEventData.genero || null,
        lugar: finalEventData.lugar || null,
        fecha: finalEventData.fecha || null,
        nuevoPrecio: finalEventData.precio || null
      };

      if (priceChanged && originalEventData) {
        payload.precioAnterior = originalEventData.precio ?? null;
        payload.priceChangeJustification =
          finalEventData.priceChangeJustification || null;
      }

      await logAdminAction("EVENT_UPDATE", payload);
    } else {
      const eventsCol = collection(window.db, "eventos");
      const newEventDocRef = await addDoc(eventsCol, {
        ...finalEventData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      const newEventId = newEventDocRef.id;

      // Crear asientos iniciales
      const seatsBatch = writeBatch(window.db);
      const rows = ["A", "B", "C", "D", "E"];
      const seatsPerRow = 10;

      for (const rowLabel of rows) {
        for (let i = 1; i <= seatsPerRow; i++) {
          const seatId = `seat-${rowLabel}${i}`;
          const seatRef = doc(
            collection(window.db, "eventos", newEventId, "seats"),
            seatId
          );
          seatsBatch.set(seatRef, {
            status: "available",
            label: `${rowLabel}${i}`,
            row: rowLabel,
            number: i
          });
        }
      }
      await seatsBatch.commit();
      showToast(
        "Evento agregado y asientos inicializados con éxito.",
        "success"
      );
      // Registrar en auditLog la creación del evento
      await logAdminAction("EVENT_CREATE", {
        eventId: newEventId,
        titulo: finalEventData.titulo || null,
        genero: finalEventData.genero || null,
        lugar: finalEventData.lugar || null,
        fecha: finalEventData.fecha || null,
        precio: finalEventData.precio || null
      });

    }

    resetEventForm();
    currentEditingEventId = null;
    if (saveEventBtn) saveEventBtn.textContent = "Guardar Evento";
    loadEvents();
    loadStatistics();
  } catch (error) {
    console.error("Error al guardar evento:", error);
    showGenericMessageModal(
      "Error al Guardar Evento",
      "No se pudo guardar el evento: " + error.message,
      false
    );
  } finally {
    if (saveEventBtn) saveEventBtn.disabled = false;
  }
}

function restoreSaveButton(isEditing) {
  if (saveEventBtn) {
    saveEventBtn.disabled = false;
    saveEventBtn.textContent = isEditing ? "Actualizar Evento" : "Guardar Evento";
  }
}

// Subida condicional de imagen (Storage)
async function uploadEventImageIfNeeded(eventData) {
  let imageUrl =
    eventImagenUrlInput && eventImagenUrlInput.value
      ? eventImagenUrlInput.value.trim()
      : "";

  const hasNewFile =
    eventImagenFileInput &&
    eventImagenFileInput.files &&
    eventImagenFileInput.files[0];

  if (!hasNewFile && imageUrl) {
    // No se cambió la imagen, usar la existente
    return imageUrl;
  }

  if (!hasNewFile && !imageUrl) {
    throw new Error("Debes seleccionar una imagen para el evento.");
  }

  if (!window.storage) {
    throw new Error("Firebase Storage no está inicializado.");
  }

  const file = eventImagenFileInput.files[0];
  const safeTitle = (eventData.titulo || "evento")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

  const filePath = `event-images/${safeTitle}-${Date.now()}-${file.name}`;
  const storageRef = ref(window.storage, filePath);

  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);

  if (eventImagenUrlInput) {
    eventImagenUrlInput.value = downloadURL;
  }

  return downloadURL;
}

// Modal de justificación de precio
function askForPriceJustification() {
  return new Promise((resolve) => {
    if (
      !priceJustificationModal ||
      !submitJustificationBtn ||
      !cancelJustificationBtn ||
      !justificationTextarea
    ) {
      resolve(null);
      return;
    }

    justificationTextarea.value = "";
    priceJustificationModal.classList.add("flex");
    priceJustificationModal.classList.remove("hidden");

    const handleSubmit = () => {
      const justification = justificationTextarea.value.trim();
      if (!justification) {
        showGenericMessageModal(
          "Campo Requerido",
          "Por favor, introduce una justificación para el cambio de precio.",
          false
        );
        return;
      }
      cleanup();
      resolve(justification);
    };

    const handleCancel = () => {
      cleanup();
      resolve(null);
    };

    function cleanup() {
      submitJustificationBtn.removeEventListener("click", handleSubmit);
      cancelJustificationBtn.removeEventListener("click", handleCancel);
      priceJustificationModal.classList.remove("flex");
      priceJustificationModal.classList.add("hidden");
    }

    submitJustificationBtn.addEventListener("click", handleSubmit);
    cancelJustificationBtn.addEventListener("click", handleCancel);
  });
}

async function deleteEvent(eventId) {
  if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
    showToast(
      "Error: No estás autenticado como administrador o Firebase no está listo.",
      "error"
    );
    return;
  }

  const confirmed = await showGenericMessageModal(
    "Confirmar Eliminación",
    "¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.",
    true,
    "Sí, Eliminar",
    "Cancelar"
  );
  if (!confirmed) return;

  try {
    const batch = writeBatch(window.db);
    const eventDocRef = doc(window.db, "eventos", eventId);

    // Eliminar compras asociadas
    const purchasesQuery = query(
      collection(window.db, "purchases"),
      where("eventId", "==", eventId)
    );
    const purchasesSnapshot = await getDocs(purchasesQuery);
    purchasesSnapshot.forEach((purchaseDoc) => {
      batch.delete(purchaseDoc.ref);
    });

    // Eliminar asientos
    const seatsSnapshot = await getDocs(
      collection(window.db, "eventos", eventId, "seats")
    );
    seatsSnapshot.forEach((seatDoc) => {
      batch.delete(seatDoc.ref);
    });

    // Evento principal
    batch.delete(eventDocRef);

    await batch.commit();
    showToast(
      "Evento, sus asientos y compras asociadas eliminados con éxito.",
      "success"
    );
    loadEvents();
    loadStatistics();
    if (currentEditingEventId === eventId) {
      resetEventForm();
    }
    // Registrar eliminación de evento en auditLog
    await logAdminAction("EVENT_DELETE", {
      eventId: eventId
    });

  } catch (error) {
    console.error("Error al eliminar evento:", error);
    showGenericMessageModal(
      "Error de Eliminación",
      "No se pudo eliminar el evento: " + error.message,
      false
    );
  }
}

function resetEventForm() {
  if (eventForm) eventForm.reset();
  if (eventIdInput) eventIdInput.value = '';
  currentEditingEventId = null;
  originalEventData = null;

  if (eventForm) {
    eventForm.querySelectorAll('.input-field-admin').forEach(input => {
      // ⚠️ No bloquear el input de archivo de imagen
      if (input.id === 'event-imagen-file') {
        input.disabled = false;
        input.classList.remove('input-locked');
      } else {
        input.disabled = true;
        input.classList.add('input-locked');
      }
    });

    eventForm.querySelectorAll('.btn-edit-field').forEach(button => {
      const icon = button.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-lock-open');
        icon.classList.add('fa-edit');
      }
    });
  }

  // Reiniciar la previsualización de la imagen
  if (eventImagePreview) {
    eventImagePreview.src = '';
    eventImagePreview.style.display = 'none';
  }
  if (eventImagePlaceholder) {
    eventImagePlaceholder.style.display = 'block';
  }

  if (saveEventBtn) saveEventBtn.textContent = 'Guardar Evento';
  if (cancelEditBtn) cancelEditBtn.style.display = 'inline-block';
}


// ========================================
//  USUARIOS
// ========================================
async function loadUsers() {
  if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
    console.error("No hay permisos de admin para cargar usuarios.");
    if (adminUserTableBody) {
      adminUserTableBody.innerHTML =
        '<tr><td colspan="5" class="error-message active">Error: Firestore no disponible o sin permisos.</td></tr>';
    }
    return;
  }

  try {
    if (adminUserTableBody) adminUserTableBody.innerHTML = "";
    if (noFilteredUsersMessage)
      noFilteredUsersMessage.style.display = "none";

    const usersCol = collection(window.db, "users");
    const userSnapshot = await getDocs(usersCol);

    allUsersData = [];
    userSnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      allUsersData.push({
        id: docSnap.id,
        ...data,
        registeredAt: data.registeredAt
          ? data.registeredAt.toDate
            ? data.registeredAt.toDate()
            : new Date(data.registeredAt)
          : null
      });
    });

    updateUserSortIcons();
    renderUsersTable(allUsersData);
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    showGenericMessageModal(
      "Error al Cargar Usuarios",
      "No se pudieron cargar los usuarios: " + error.message,
      false
    );
    if (adminUserTableBody) {
      adminUserTableBody.innerHTML =
        '<tr><td colspan="5" class="error-message active">Error al cargar usuarios.</td></tr>';
    }
  }
}

function updateUserSortIcons() {
  if (!adminUserTableHead) return;
  adminUserTableHead.querySelectorAll("th[data-sort]").forEach((header) => {
    const icon = header.querySelector("i.fas");
    if (!icon) return;
    icon.classList.remove("fa-sort-up", "fa-sort-down");
    icon.classList.add("fa-sort");

    if (header.dataset.sort === currentUserSortColumn) {
      icon.classList.remove("fa-sort");
      icon.classList.add(
        currentUserSortDirection === "asc" ? "fa-sort-up" : "fa-sort-down"
      );
    }
  });
}

function renderUsersTable(usersData) {
  if (!adminUserTableBody) return;
  adminUserTableBody.innerHTML = "";

  const sortedUsers = [...usersData].sort((a, b) => {
    let valA = a[currentUserSortColumn];
    let valB = b[currentUserSortColumn];

    if (currentUserSortColumn === "registeredAt") {
      valA = valA ? valA.getTime() : 0;
      valB = valB ? valB.getTime() : 0;
    } else {
      valA = String(valA || "");
      valB = String(valB || "");
    }

    if (valA < valB) return currentUserSortDirection === "asc" ? -1 : 1;
    if (valA > valB) return currentUserSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (sortedUsers.length === 0) {
    if (noFilteredUsersMessage)
      noFilteredUsersMessage.style.display = "block";
    return;
  } else {
    if (noFilteredUsersMessage)
      noFilteredUsersMessage.style.display = "none";
  }

  sortedUsers.forEach((userData) => {
    const row = adminUserTableBody.insertRow();
    row.dataset.id = userData.id;

    const registeredDate =
      userData.registeredAt instanceof Date
        ? formatTimestamp(userData.registeredAt)
        : "N/A";

    row.innerHTML = `
      <td data-label="Email">${userData.email || "N/A"}</td>
      <td data-label="UID">${userData.id}</td>
      <td data-label="Nombre">${userData.name || "N/A"}</td>
      <td data-label="Fecha Registro">${registeredDate}</td>
      <td class="actions" data-label="Acciones">
        <div class="button-group-table">
          <button class="btn btn-edit btn-small" data-id="${userData.id}" data-action="edit-user">✏️ Editar</button>
          <button class="btn btn-delete btn-small" data-id="${userData.id}" data-action="delete-user">🗑️ Eliminar</button>
        </div>
      </td>
    `;
  });

  adminUserTableBody
    .querySelectorAll('[data-action="edit-user"]')
    .forEach((button) =>
      button.addEventListener("click", (e) =>
        editUser(e.currentTarget.dataset.id)
      )
    );

  adminUserTableBody
    .querySelectorAll('[data-action="delete-user"]')
    .forEach((button) =>
      button.addEventListener("click", (e) =>
        deleteUser(e.currentTarget.dataset.id)
      )
    );
}

async function editUser(userId) {
  if (!window.db) {
    showToast("Error: Firestore no está inicializado.", "error");
    return;
  }

  try {
    const userDocRef = doc(window.db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      showToast("Usuario no encontrado para editar.", "error");
      return;
    }

    const userData = userDoc.data();
    if (editUserIdInput) editUserIdInput.value = userId;
    if (editUserNameInput) editUserNameInput.value = userData.name || "";
    if (editUserEmailInput) editUserEmailInput.value = userData.email || "";

    if (editUserModal) {
      editUserModal.classList.add("flex");
      editUserModal.classList.remove("hidden");
    }
  } catch (error) {
    console.error("Error al cargar usuario para edición:", error);
    showGenericMessageModal(
      "Error",
      "No se pudo cargar el usuario para editar: " + error.message,
      false
    );
  }
}

async function handleEditUserFormSubmit(e) {
  e.preventDefault();

  const userId = editUserIdInput ? editUserIdInput.value : "";
  const newName = editUserNameInput ? editUserNameInput.value.trim() : "";

  if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
    showToast(
      "Error: No estás autenticado como administrador o Firebase no está listo.",
      "error"
    );
    return;
  }

  try {
    const userDocRef = doc(window.db, "users", userId);
    const updates = {};

    if (newName) updates.name = newName;

    if (Object.keys(updates).length > 0) {
      await updateDoc(userDocRef, updates);
      showToast("Perfil de usuario actualizado en Firestore.", "success");
      loadUsers();

      // Registrar actualización de usuario en auditLog
      await logAdminAction("USER_UPDATE", {
        targetUserId: userId,
        updatedFields: Object.keys(updates),
        newName: updates.name || null
      });
    } else {
      showToast("No hay cambios para guardar.", "info");
    }


    if (userId === currentAuthUser.uid && newName) {
      try {
        await updateProfile(currentAuthUser, { displayName: newName });
      } catch (profileError) {
        console.warn(
          "No se pudo actualizar el perfil de Auth del admin actual:",
          profileError
        );
        showToast(
          "Advertencia: No se pudo actualizar el nombre en el perfil de autenticación. " +
          profileError.message,
          "warning"
        );
      }
    }

    if (editUserModal) {
      editUserModal.classList.remove("flex");
      editUserModal.classList.add("hidden");
    }
    if (editUserForm) editUserForm.reset();
  } catch (error) {
    console.error("Error al guardar cambios del usuario:", error);
    showGenericMessageModal(
      "Error al Guardar Cambios",
      "No se pudieron guardar los cambios del usuario: " + error.message,
      false
    );
  }
}

async function deleteUser(userId) {
  if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
    showToast(
      "Error: No estás autenticado como administrador o Firebase no está listo.",
      "error"
    );
    return;
  }

  if (userId === ADMIN_UID) {
    showGenericMessageModal(
      "Operación no permitida",
      "No puedes eliminar tu propia cuenta de administrador.",
      false
    );
    return;
  }

  const confirmed = await showGenericMessageModal(
    "Confirmar Eliminación",
    `¿Estás seguro de que quieres eliminar al usuario ${userId}? Esta acción solo eliminará el documento del usuario en Firestore.`,
    true,
    "Sí, Eliminar Documento",
    "Cancelar"
  );
  if (!confirmed) return;

  try {
    const userDocRef = doc(window.db, "users", userId);
    await deleteDoc(userDocRef);

    showToast(
      `Documento de usuario "${userId}" eliminado de Firestore.`,
      "success",
      7000
    );
    loadUsers();

    await logAdminAction("USER_DELETE", {
      targetUserId: userId
    });

  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    showGenericMessageModal(
      "Error de Eliminación",
      "No se pudo eliminar el documento del usuario: " + error.message,
      false
    );
  }
}

// ========================================
//  ESTADÍSTICAS
// ========================================
async function loadStatistics() {
  try {
    if (!window.db) {
      showToast("Error: Firestore no está inicializado.", "error");
      return;
    }

    // 1) Total de eventos
    const eventsSnap = await getDocs(collection(window.db, "eventos"));
    const totalEvents = eventsSnap.size;
    if (statTotalEvents) {
      statTotalEvents.textContent = totalEvents;
    }

    // 2) Total de usuarios
    const usersSnap = await getDocs(collection(window.db, "users"));
    const totalUsers = usersSnap.size;
    if (statTotalUsers) {
      statTotalUsers.textContent = totalUsers;
    }

    // 3) Compras: tickets, ingresos, top eventos y datos para gráficos
    const purchasesSnap = await getDocs(collection(window.db, "purchases"));

    let totalTicketsSold = 0;
    let totalRevenue = 0;

    // Mapa para top eventos y gráfico de tickets por evento
    const eventsStatsMap = new Map();
    // Mapa para gráfico de ingresos por mes (YYYY-MM -> total CLP)
    const revenueByMonthMap = new Map();

    if (!purchasesSnap.empty) {
      purchasesSnap.forEach((docSnap) => {
        const data = docSnap.data();

        const quantity = data.quantity || 0;
        const totalAmount = data.totalAmount || 0;
        const eventTitle = data.eventTitle || "Evento sin título";

        totalTicketsSold += quantity;
        totalRevenue += totalAmount;

        // Agregar al mapa de eventos
        const currentStats = eventsStatsMap.get(eventTitle) || { tickets: 0, revenue: 0 };
        currentStats.tickets += quantity;
        currentStats.revenue += totalAmount;
        eventsStatsMap.set(eventTitle, currentStats);

        // Agregar al mapa de ingresos por mes (si tenemos purchaseDate)
        if (data.purchaseDate && typeof data.purchaseDate.toDate === "function") {
          const d = data.purchaseDate.toDate();
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
          const currentRevenue = revenueByMonthMap.get(key) || 0;
          revenueByMonthMap.set(key, currentRevenue + totalAmount);
        }
      });
    }

    if (statTicketsSold) {
      statTicketsSold.textContent = totalTicketsSold;
    }

    if (statTotalRevenue) {
      statTotalRevenue.textContent = `CLP$${totalRevenue.toLocaleString("es-CL")}`;
    }

    // 4) Tabla de "Eventos con Más Ventas"
    if (statTopEventsTableBody) {
      statTopEventsTableBody.innerHTML = "";

      if (eventsStatsMap.size === 0) {
        if (noTopEventsMessage) {
          noTopEventsMessage.style.display = "block";
        }
      } else {
        if (noTopEventsMessage) {
          noTopEventsMessage.style.display = "none";
        }

        const sortedEvents = Array.from(eventsStatsMap.entries()).sort(
          (a, b) => b[1].tickets - a[1].tickets
        );

        sortedEvents.forEach(([title, stats]) => {
          const tr = document.createElement("tr");

          const tdTitle = document.createElement("td");
          tdTitle.textContent = title;

          const tdTickets = document.createElement("td");
          tdTickets.textContent = stats.tickets;

          const tdRevenue = document.createElement("td");
          tdRevenue.textContent = `CLP$${stats.revenue.toLocaleString("es-CL")}`;

          tr.appendChild(tdTitle);
          tr.appendChild(tdTickets);
          tr.appendChild(tdRevenue);

          statTopEventsTableBody.appendChild(tr);
        });
      }
    }

    // 5) Preparar datos para los gráficos
    const ticketsLabels = [];
    const ticketsValues = [];
    eventsStatsMap.forEach((stats, title) => {
      ticketsLabels.push(title);
      ticketsValues.push(stats.tickets);
    });

    const monthLabels = Array.from(revenueByMonthMap.keys()).sort(); // YYYY-MM ordenado
    const revenueValues = monthLabels.map((key) => revenueByMonthMap.get(key));

    // 6) Actualizar los gráficos del dashboard
    updateDashboardCharts(
      { labels: ticketsLabels, data: ticketsValues },
      { labels: monthLabels, data: revenueValues }
    );
  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
    showToast("Error al cargar las estadísticas.", "error");
  }
}

/**
 * Crea o actualiza los gráficos del dashboard de estadísticas.
 * @param {{labels: string[], data: number[]}} ticketsDataset
 * @param {{labels: string[], data: number[]}} revenueDataset
 */
function updateDashboardCharts(ticketsDataset, revenueDataset) {
  const ticketsCanvas = document.getElementById("chart-tickets-by-event");
  const revenueCanvas = document.getElementById("chart-revenue-by-month");

  if (typeof Chart === "undefined") {
    console.warn("Chart.js no está cargado, no se pueden renderizar gráficos.");
    return;
  }

  if (!ticketsCanvas || !revenueCanvas) {
    // Si aún no se ha renderizado la pestaña o no existen los canvas
    return;
  }

  // Destruir instancias anteriores para evitar fugas de memoria
  if (ticketsByEventChart) {
    ticketsByEventChart.destroy();
    ticketsByEventChart = null;
  }
  if (revenueByMonthChart) {
    revenueByMonthChart.destroy();
    revenueByMonthChart = null;
  }

  // Gráfico de entradas por evento
  if (ticketsDataset.labels.length > 0) {
    ticketsByEventChart = new Chart(ticketsCanvas, {
      type: "bar",
      data: {
        labels: ticketsDataset.labels,
        datasets: [
          {
            label: "Entradas vendidas",
            data: ticketsDataset.data,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }

  // Gráfico de ingresos por mes
  if (revenueDataset.labels.length > 0) {
    revenueByMonthChart = new Chart(revenueCanvas, {
      type: "line",
      data: {
        labels: revenueDataset.labels,
        datasets: [
          {
            label: "Ingresos (CLP)",
            data: revenueDataset.data,
            borderWidth: 2,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
}


/**
 * Convierte un valor a una celda CSV escapando comillas.
 * @param {any} value
 * @returns {string}
 */
function csvCell(value) {  // NUEVO
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exporta todas las compras de la colección 'purchases' a un CSV descargable.
 */
async function exportAllPurchasesToCSV() {  // NUEVO
  try {
    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
      showToast("Solo el administrador puede exportar las compras.", "error");
      return;
    }

    if (exportPurchasesStatus) {
      exportPurchasesStatus.textContent = 'Generando archivo CSV...';
    }

    const purchasesColRef = collection(window.db, 'purchases');
    const purchasesSnapshot = await getDocs(purchasesColRef);

    if (purchasesSnapshot.empty) {
      if (exportPurchasesStatus) {
        exportPurchasesStatus.textContent = 'No hay compras registradas para exportar.';
      }
      showToast("No hay compras registradas.", "info");
      return;
    }

    // Encabezados del CSV
    const headers = [
      "ID Compra",
      "UID Usuario",
      "Email Usuario",          // 👈 NUEVO
      "ID Evento",
      "Título Evento",
      "Fecha Evento",
      "Lugar Evento",
      "Precio Unitario (CLP)",
      "Cantidad",
      "Total Pagado (CLP)",
      "Asientos",
      "Fecha Compra"
    ];


    const rows = [];
    rows.push(headers.map(csvCell).join(';')); // Usamos ; como separador (puedes cambiar a , si prefieres)

    purchasesSnapshot.forEach(docSnap => {
      const data = docSnap.data();

      const purchaseId = docSnap.id;
      const userId = data.userId || '';
      const userEmail = data.userEmail || '';          // 👈 NUEVO
      const eventId = data.eventId || '';
      const eventTitle = data.eventTitle || '';
      const eventLocation = data.eventLocation || '';
      const ticketPrice = data.ticketPrice ?? '';
      const quantity = data.quantity ?? '';
      const totalAmount = data.totalAmount ?? '';
      const seats = Array.isArray(data.selectedSeats) ? data.selectedSeats.join(', ') : '';

      const eventDateStr = data.eventDate ? formatTimestamp(data.eventDate) : '';
      const purchaseDateStr = data.purchaseDate ? formatTimestamp(data.purchaseDate) : '';

      const row = [
        purchaseId,
        userId,
        userEmail,          // 👈 NUEVO (posición 3, igual que en headers)
        eventId,
        eventTitle,
        eventDateStr,
        eventLocation,
        ticketPrice,
        quantity,
        totalAmount,
        seats,
        purchaseDateStr
      ];


      rows.push(row.map(csvCell).join(';'));
    });

    const csvContent = rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // yyyy-mm-dd
    const fileName = `compras_DramaTicket_${dateStr}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    if (exportPurchasesStatus) {
      exportPurchasesStatus.textContent =
        `Exportación completada. Se descargó un archivo con ${purchasesSnapshot.size} compras.`;
    }
    showToast("Compras exportadas correctamente.", "success");

    await logAdminAction("PURCHASES_EXPORT", {
      totalPurchases: purchasesSnapshot.size
    });

  } catch (error) {
    console.error("Error al exportar compras a CSV:", error);
    if (exportPurchasesStatus) {
      exportPurchasesStatus.textContent = 'Error al exportar las compras. Revisa la consola para más detalles.';
    }
    showToast("Error al exportar las compras: " + error.message, "error");
  }
}
