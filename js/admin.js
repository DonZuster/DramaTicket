// js/admin.js

// Importa las funciones necesarias de Firestore modular
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Importa las funciones de utilidad (modales y formato de fecha)
import { formatTimestamp, showToast, showGenericMessageModal } from './utils.js';
// Importa auth y db desde firebase-init.js (asumiendo que se exportan globalmente como window.auth, window.db)
// O si no, importarlos directamente si firebase-init.js los exporta de forma modular:
// import { auth, db } from './firebase-init.js'; // Descomentar si usas exportaciones directas

// UID del administrador - ¡ES CRÍTICO QUE ESTE UID COINCIDA CON EL UID REAL DE TU CUENTA DE ADMINISTRADOR EN FIREBASE!
// Puedes encontrarlo en la consola de Firebase -> Authentication.
const ADMIN_UID = 'poQqw14QiYVb2Y05vQKS5dPLsPE2'; 

// --- Variables para los elementos del DOM (declaradas pero inicializadas en DOMContentLoaded) ---
let authStatusMessage;
let adminUserIdDisplay;
let signOutBtn;

// Pestañas
let tabEventsBtn;
let tabUsersBtn;
let tabStatisticsBtn;
let eventsTabContent;
let usersTabContent;
let statisticsTabContent;

// Formulario de Eventos
let eventForm;
let eventIdInput;
let eventTituloInput;
let eventGeneroInput;
let eventLugarInput;
let eventFechaInput;
let eventPrecioInput;
let eventImagenUrlInput; // Cambio a URL de imagen
let eventImagePreview; // Elemento para previsualizar la imagen
let eventImagePlaceholder; // Elemento para el texto "Sin imagen"
let eventDescripcionInput;
let cancelEditBtn;
let saveEventBtn;
let editFieldButtons; // Botones de lápiz/candado

// Modales
let priceJustificationModal;
let justificationTextarea;
let submitJustificationBtn;
let cancelJustificationBtn;

// Tablas
let adminEventTableBody;
let adminEventTableHead;
let adminUserTableBody;
let adminUserTableHead;
let statTotalEvents;
let statTotalUsers;
let statTicketsSold;
let statTotalRevenue;
let statTopEventsTableBody;
let noTopEventsMessage;
let noFilteredEventsMessage;
let noFilteredUsersMessage;

// Modal de edición de usuario
let editUserModal;
let editUserForm;
let editUserIdInput;
let editUserNameInput;
let editUserEmailInput;
let cancelEditUserBtn;

let currentEditingEventId = null; 
let currentAuthUser = null; 
let originalEventData = null; 
let allEventsData = []; 
let allUsersData = []; 

let currentEventSortColumn = 'titulo'; 
let currentEventSortDirection = 'asc'; 

let currentUserSortColumn = 'registeredAt'; 
let currentUserSortDirection = 'asc'; 

// --- Inicialización y Escucha de Autenticación ---
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que Firebase Auth y Firestore estén inicializados globalmente por firebase-init.js
    // También asegúrate de que los elementos DOM necesarios para setupEventListeners estén disponibles.
    const checkFirebaseAndDOMReady = setInterval(() => {
        if (
            typeof window.auth !== 'undefined' &&
            typeof window.db !== 'undefined' &&
            typeof window.appId !== 'undefined' &&
            document.getElementById('tab-events') // Un elemento DOM clave para saber que está renderizado
        ) {
            clearInterval(checkFirebaseAndDOMReady);
            console.log("admin.js: Firebase Auth, Firestore, appId y elementos DOM principales disponibles.");
            initializeAdminPanel();
        } else {
            console.warn("admin.js: Firebase o elementos DOM no están completamente inicializados aún. Reintentando...");
        }
    }, 100);
});

function initializeAdminPanel() {
    // Inicialización de todas las variables DOM
    authStatusMessage = document.getElementById('auth-status-message'); // CORREGIDO: Usar el ID correcto del HTML
    adminUserIdDisplay = document.getElementById('admin-user-id');
    signOutBtn = document.getElementById('sign-out-btn');

    tabEventsBtn = document.getElementById('tab-events');
    tabUsersBtn = document.getElementById('tab-users');
    tabStatisticsBtn = document.getElementById('tab-statistics');
    eventsTabContent = document.getElementById('events-tab-content');
    usersTabContent = document.getElementById('users-tab-content');
    statisticsTabContent = document.getElementById('statistics-tab-content');

    eventForm = document.getElementById('event-form');
    eventIdInput = document.getElementById('event-id');
    eventTituloInput = document.getElementById('event-titulo');
    eventGeneroInput = document.getElementById('event-genero');
    eventLugarInput = document.getElementById('event-lugar');
    eventFechaInput = document.getElementById('event-fecha');
    eventPrecioInput = document.getElementById('event-precio');
    eventImagenUrlInput = document.getElementById('event-imagen-url'); // Nuevo ID para la URL
    eventImagePreview = document.getElementById('event-image-preview').querySelector('img'); // Previsualización de imagen
    eventImagePlaceholder = document.getElementById('event-image-preview').querySelector('.text-placeholder'); // Placeholder de texto
    eventDescripcionInput = document.getElementById('event-descripcion');
    cancelEditBtn = document.getElementById('cancel-edit-btn');
    saveEventBtn = eventForm ? eventForm.querySelector('button[type="submit"]') : null;
    editFieldButtons = document.querySelectorAll('.input-group-admin .btn-edit-field'); 

    priceJustificationModal = document.getElementById('price-justification-modal');
    justificationTextarea = document.getElementById('justification-textarea');
    submitJustificationBtn = document.getElementById('submit-justification-btn');
    cancelJustificationBtn = document.getElementById('cancel-justification-btn');

    adminEventTableBody = document.getElementById('admin-event-table-body'); // Usar el ID del tbody
    adminEventTableHead = document.querySelector('#admin-event-table thead');
    noFilteredEventsMessage = document.getElementById('no-filtered-events-message'); // Mensaje de no eventos filtrados

    adminUserTableBody = document.getElementById('admin-user-table-body');
    adminUserTableHead = document.querySelector('#admin-user-table thead');
    noFilteredUsersMessage = document.getElementById('no-filtered-users-message'); // Mensaje de no usuarios filtrados

    editUserModal = document.getElementById('edit-user-modal');
    editUserForm = document.getElementById('edit-user-form');
    editUserIdInput = document.getElementById('edit-user-id');
    editUserNameInput = document.getElementById('edit-user-name');
    editUserEmailInput = document.getElementById('edit-user-email');
    cancelEditUserBtn = document.getElementById('cancel-edit-user-btn');

    statTotalEvents = document.getElementById('stat-total-events');
    statTotalUsers = document.getElementById('stat-total-users');
    statTicketsSold = document.getElementById('stat-tickets-sold');
    statTotalRevenue = document.getElementById('stat-total-revenue');
    statTopEventsTableBody = document.querySelector('#stat-top-events-table tbody');
    noTopEventsMessage = document.getElementById('no-top-events-message');


    // Escuchar cambios en el estado de autenticación
    onAuthStateChanged(window.auth, async (user) => {
        currentAuthUser = user; 
        if (user) {
            adminUserIdDisplay.textContent = `UID: ${user.uid}`;
            signOutBtn.style.display = 'block';

            if (user.uid === ADMIN_UID) {
                authStatusMessage.textContent = `Bienvenido, ${user.email || 'Administrador'}.`;
                authStatusMessage.classList.remove('info-message', 'error-message');
                authStatusMessage.classList.add('success-message');
                setupEventListeners(); 
                switchTab('events'); 
            } else {
                authStatusMessage.textContent = 'Acceso Denegado: No tienes permisos de administrador.';
                authStatusMessage.classList.remove('success-message', 'info-message');
                authStatusMessage.classList.add('error-message');
                eventsTabContent.style.display = 'none';
                usersTabContent.style.display = 'none';
                statisticsTabContent.style.display = 'none';
                tabEventsBtn.style.display = 'none';
                tabUsersBtn.style.display = 'none';
                tabStatisticsBtn.style.display = 'none';
                signOutBtn.style.display = 'none';
                // Redirigir si el usuario no es admin y está en la página de admin
                if (window.location.pathname.includes('admin.html')) {
                    showGenericMessageModal("Acceso Denegado", "Solo los administradores tienen acceso a este panel.", true, "Ir a Inicio", "Cerrar")
                        .then(confirmed => {
                            if (confirmed) {
                                window.location.href = 'index.html';
                            }
                        });
                }
            }
        } else {
            authStatusMessage.textContent = 'Inicia sesión para acceder al panel de administración.';
            authStatusMessage.classList.remove('success-message', 'error-message');
            authStatusMessage.classList.add('info-message');
            adminUserIdDisplay.textContent = '';
            signOutBtn.style.display = 'none';
            eventsTabContent.style.display = 'none';
            usersTabContent.style.display = 'none';
            statisticsTabContent.style.display = 'none';
            tabEventsBtn.style.display = 'none';
            tabUsersBtn.style.display = 'none';
            tabStatisticsBtn.style.display = 'none';
            // Redirigir si no hay usuario autenticado y está en una página protegida
            const currentPath = window.location.pathname.split('/').pop();
            const protectedPages = ['admin.html', 'my-account.html', 'payment-details.html', 'confirmacion.html'];
            if (protectedPages.includes(currentPath) && currentPath !== 'login.html' && currentPath !== 'register.html') {
                showGenericMessageModal("Acceso Restringido", "Necesitas iniciar sesión para acceder a esta página.", true, "Ir a Login", "Cerrar")
                    .then(confirmed => {
                        if (confirmed) {
                            window.location.href = 'login.html';
                        } else {
                            window.location.href = 'index.html'; // O redirigir a una página pública si cancela
                        }
                    });
            }
        }
    });

    // Asegurarse de que el formulario de eventos se resetee y los campos se bloqueen al cargar la página por primera vez
    resetEventForm();
}

// --- Configuración de Event Listeners ---
function setupEventListeners() {
    // Manejadores de pestañas - Asegurarse de que existan antes de añadir listener
    if (tabEventsBtn) tabEventsBtn.addEventListener('click', () => switchTab('events'));
    if (tabUsersBtn) tabUsersBtn.addEventListener('click', () => switchTab('users'));
    if (tabStatisticsBtn) tabStatisticsBtn.addEventListener('click', () => switchTab('statistics'));

    // Manejador del formulario de eventos
    if (eventForm) eventForm.addEventListener('submit', handleEventFormSubmit);

    // Botones de edición de campo del formulario de eventos
    if (editFieldButtons) {
        editFieldButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const inputField = e.currentTarget.previousElementSibling;
                if (inputField) {
                    inputField.disabled = !inputField.disabled; // Alternar el atributo disabled
                    inputField.classList.toggle('input-locked', inputField.disabled); // Alternar clase CSS

                    // Cambiar icono de lápiz a candado abierto y viceversa
                    const icon = e.currentTarget.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-edit');
                        icon.classList.add('fa-lock-open');
                    }
                    // Si el campo es editable, enfócalo
                    if (!inputField.disabled) {
                        inputField.focus();
                    }
                }
            });
        });
    }

    // Cancelar edición de evento (limpia el formulario y bloquea los campos)
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            resetEventForm();
            currentEditingEventId = null;
            if (saveEventBtn) saveEventBtn.textContent = 'Guardar Evento'; // Texto para nuevo evento
            showToast('Edición de evento cancelada.', 'info');
        });
    }

    // Manejador para el botón de cerrar sesión del admin.html
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            try {
                await window.auth.signOut(); 
                console.log("Sesión cerrada exitosamente desde admin.html.");
                window.location.href = 'index.html'; 
            } catch (error) {
                console.error("Error al cerrar sesión desde admin.html:", error);
                showToast("Error al cerrar sesión: " + error.message, "error");
            }
        });
    }

    // Manejador para el botón de enviar justificación del modal de precio
    if (submitJustificationBtn) {
        submitJustificationBtn.addEventListener('click', async () => {
            const justification = justificationTextarea.value.trim();
            if (justification) {
                if (priceJustificationModal) {
                    priceJustificationModal.classList.remove('flex');
                    priceJustificationModal.classList.add('hidden');
                }
                await saveEventChanges(justification);
            } else {
                showGenericMessageModal("Campo Requerido", "Por favor, introduce una justificación para el cambio de precio.", false);
            }
        });
    }

    // Manejador para el botón de cancelar justificación del modal de precio
    if (cancelJustificationBtn) {
        cancelJustificationBtn.addEventListener('click', () => {
            if (priceJustificationModal) {
                priceJustificationModal.classList.remove('flex');
                priceJustificationModal.classList.add('hidden');
            }
            showToast("Cambio de precio cancelado. Precio no modificado.", "info");
            // Restaurar el valor original del precio y bloquear el campo
            if (originalEventData && originalEventData.precio !== undefined && eventPrecioInput) {
                eventPrecioInput.value = originalEventData.precio;
                eventPrecioInput.disabled = true;
                eventPrecioInput.classList.add('input-locked');
                const priceEditButton = eventPrecioInput.closest('.input-group-admin').querySelector('.btn-edit-field i');
                if (priceEditButton) {
                     priceEditButton.classList.remove('fa-lock-open');
                     priceEditButton.classList.add('fa-edit');
                }
            }
            if (saveEventBtn) {
                saveEventBtn.disabled = false;
                saveEventBtn.textContent = currentEditingEventId ? 'Actualizar Evento' : 'Guardar Evento';
            }
        });
    }

    // Event Listeners para los encabezados de la tabla de eventos para ordenar
    if (adminEventTableHead) {
        adminEventTableHead.querySelectorAll('th[data-sort]').forEach(header => {
            header.style.cursor = 'pointer'; 
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                if (currentEventSortColumn === column) {
                    currentEventSortDirection = currentEventSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentEventSortColumn = column;
                    currentEventSortDirection = 'asc'; 
                }
                updateEventSortIcons(); 
                renderEventsTable(allEventsData); 
            });
        });
    }

    // Event Listeners para los encabezados de la tabla de USUARIOS para ordenar
    if (adminUserTableHead) {
        adminUserTableHead.querySelectorAll('th[data-sort]').forEach(header => {
            header.style.cursor = 'pointer'; 
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                if (currentUserSortColumn === column) {
                    currentUserSortDirection = currentUserSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentUserSortColumn = column;
                    currentUserSortDirection = 'asc'; 
                }
                updateUserSortIcons(); 
                renderUsersTable(allUsersData); 
            });
        });
    }

    // Manejadores del modal de edición de usuario
    if (editUserForm) editUserForm.addEventListener('submit', handleEditUserFormSubmit);
    if (cancelEditUserBtn) {
        cancelEditUserBtn.addEventListener('click', () => {
            if (editUserModal) {
                editUserModal.classList.remove('flex');
                editUserModal.classList.add('hidden');
            }
            if (editUserForm) editUserForm.reset(); 
        });
    }

    // Listener para actualizar la previsualización de la imagen al cambiar la URL
    if (eventImagenUrlInput) {
        eventImagenUrlInput.addEventListener('input', () => {
            const imageUrl = eventImagenUrlInput.value;
            if (imageUrl) {
                eventImagePreview.src = imageUrl;
                eventImagePreview.style.display = 'block';
                eventImagePlaceholder.style.display = 'none';
            } else {
                eventImagePreview.src = '';
                eventImagePreview.style.display = 'none';
                eventImagePlaceholder.style.display = 'block';
            }
        });
    }
}

// --- Funciones de Gestión de Pestañas ---
function switchTab(tabId) {
    // Remover clase 'active' de todos los botones y contenidos
    document.querySelectorAll('.admin-tabs .tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.remove('active', 'hidden'));
    document.querySelectorAll('.admin-tab-content').forEach(content => content.classList.add('hidden'));

    // Añadir clase 'active' al botón y contenido correctos
    if (tabId === 'events') {
        tabEventsBtn.classList.add('active');
        eventsTabContent.classList.add('active');
        eventsTabContent.classList.remove('hidden');
        loadEvents(); 
    } else if (tabId === 'users') {
        tabUsersBtn.classList.add('active');
        usersTabContent.classList.add('active');
        usersTabContent.classList.remove('hidden');
        loadUsers(); 
    } else if (tabId === 'statistics') {
        tabStatisticsBtn.classList.add('active');
        statisticsTabContent.classList.add('active');
        statisticsTabContent.classList.remove('hidden');
        loadStatistics(); 
    }
}


// --- Funciones de Gestión de Eventos ---

/**
 * Carga todos los eventos desde Firestore y los almacena para el filtrado/ordenamiento.
 */
async function loadEvents() {
    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        console.error("Firestore no está inicializado o el usuario no es admin. No se pueden cargar los eventos.");
        if (adminEventTableBody) {
            adminEventTableBody.innerHTML = '<tr><td colspan="7" class="error-message active">Error: Firestore no disponible o sin permisos.</td></tr>';
        }
        return;
    }

    try {
        const eventsCol = collection(window.db, 'eventos'); // Asegúrate de que la colección es 'eventos'
        const eventSnapshot = await getDocs(eventsCol);
        
        allEventsData = []; 
        eventSnapshot.forEach(doc => {
            const data = doc.data();
            allEventsData.push({
                id: doc.id,
                ...data,
                // Convertir Timestamps de Firestore a objetos Date de JS para facilitar el ordenamiento
                fecha: data.fecha && typeof data.fecha.toDate === 'function' ? data.fecha.toDate() : null
            });
        });
        console.log("Todos los eventos cargados:", allEventsData);
        updateEventSortIcons(); 
        renderEventsTable(allEventsData); 

    }
    catch (error) {
        console.error("Error al cargar eventos:", error);
        showGenericMessageModal("Error al Cargar Eventos", "No se pudieron cargar los eventos: " + error.message, false);
        if (adminEventTableBody) {
            adminEventTableBody.innerHTML = '<tr><td colspan="7" class="error-message active">Error al cargar eventos.</td></tr>';
        }
    }
}

/**
 * Actualiza los iconos de ordenación en los encabezados de la tabla de eventos.
 */
function updateEventSortIcons() {
    if (!adminEventTableHead) return;
    adminEventTableHead.querySelectorAll('th[data-sort]').forEach(header => {
        const icon = header.querySelector('i.fas');
        if (icon) {
            icon.classList.remove('fa-sort-up', 'fa-sort-down');
            icon.classList.add('fa-sort'); // Pone el icono por defecto para todos

            if (header.dataset.sort === currentEventSortColumn) {
                // Si esta es la columna de ordenación actual, ajusta el icono
                icon.classList.remove('fa-sort');
                icon.classList.add(currentEventSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            }
        }
    });
}

/**
 * Renderiza la tabla de eventos con los datos proporcionados, aplicando ordenamiento.
 * @param {Array<Object>} eventsData - Array de objetos de evento a renderizar.
 */
function renderEventsTable(eventsData) {
    if (!adminEventTableBody) return;
    adminEventTableBody.innerHTML = ''; // Limpiar la tabla

    // Aplicar ordenamiento
    const sortedEvents = [...eventsData].sort((a, b) => {
        let valA = a[currentEventSortColumn];
        let valB = b[currentEventSortColumn];

        if (currentEventSortColumn === 'fecha') {
            valA = valA ? valA.getTime() : 0; 
            valB = valB ? valB.getTime() : 0;
        } 
        else if (currentEventSortColumn === 'precio') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        }
        else { // Para cadenas, asegurarse de que sean cadenas y no null/undefined
            valA = String(valA || '');
            valB = String(valB || '');
        }

        if (valA < valB) {
            return currentEventSortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return currentEventSortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });

    if (sortedEvents.length === 0) {
        if (noFilteredEventsMessage) noFilteredEventsMessage.style.display = 'block';
        return;
    } else {
        if (noFilteredEventsMessage) noFilteredEventsMessage.style.display = 'none';
    }

    sortedEvents.forEach(eventData => {
        const row = adminEventTableBody.insertRow();
        row.dataset.id = eventData.id; 

        // Formatear la fecha para la visualización
        const eventDateFormatted = eventData.fecha ? formatTimestamp(eventData.fecha) : 'N/A';
        // Usar una imagen placeholder si la URL está vacía
        const imageUrl = eventData.imagen && eventData.imagen.trim() !== '' ? eventData.imagen : 'https://placehold.co/80x80/cccccc/000000?text=No+Img';
        
        row.innerHTML = `
            <td data-label="Título">${eventData.titulo || 'N/A'}</td>
            <td data-label="Género">${eventData.genero || 'N/A'}</td>
            <td data-label="Lugar">${eventData.lugar || 'N/A'}</td>
            <td data-label="Fecha">${eventDateFormatted}</td>
            <td data-label="Precio">CLP$${eventData.precio ? eventData.precio.toFixed(0) : '0'}</td>
            <td data-label="Imagen"><img src="${imageUrl}" alt="${eventData.titulo || 'Evento'}" style="max-width: 80px; height: auto; border-radius: 4px;"></td>
            <td class="actions" data-label="Acciones">
                <div class="button-group-table">
                    <button class="btn btn-edit btn-small" data-id="${eventData.id}">✏️ Editar</button>
                    <button class="btn btn-delete btn-small" data-id="${eventData.id}">🗑️ Eliminar</button>
                </div>
            </td>
        `;
    });

    // Añadir listeners a los botones de Editar y Eliminar después de renderizar
    adminEventTableBody.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', (e) => editEvent(e.currentTarget.dataset.id));
    });

    adminEventTableBody.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => deleteEvent(e.currentTarget.dataset.id));
    });
}


/**
 * Rellena el formulario con los datos de un evento para edición.
 * @param {string} eventId - ID del evento a editar.
 */
async function editEvent(eventId) {
    if (!window.db) {
        showToast("Error: Firestore no está inicializado.", "error");
        return;
    }

    try {
        const eventDocRef = doc(window.db, 'eventos', eventId);
        const eventDoc = await getDoc(eventDocRef);

        if (eventDoc.exists()) {
            const event = eventDoc.data();
            currentEditingEventId = eventId; 
            originalEventData = { ...event }; 

            if (eventIdInput) eventIdInput.value = eventId;
            if (eventTituloInput) eventTituloInput.value = event.titulo || '';
            if (eventGeneroInput) eventGeneroInput.value = event.genero || '';
            if (eventLugarInput) eventLugarInput.value = event.lugar || '';
            
            // Formatear la fecha para el input datetime-local
            if (eventFechaInput) {
                if (event.fecha && typeof event.fecha.toDate === 'function') {
                    const date = event.fecha.toDate();
                    eventFechaInput.value = date.toISOString().slice(0, 16); // Formato,"%Y-%m-%dT%H:%M"
                } else {
                    eventFechaInput.value = '';
                }
            }
            if (eventPrecioInput) eventPrecioInput.value = event.precio || 0;
            if (eventDescripcionInput) eventDescripcionInput.value = event.descripcion || '';

            // Cargar la URL de la imagen y mostrar previsualización
            if (eventImagenUrlInput) {
                eventImagenUrlInput.value = event.imagen || ''; 
                if (event.imagen && event.imagen.trim() !== '') {
                    eventImagePreview.src = event.imagen;
                    eventImagePreview.style.display = 'block';
                    eventImagePlaceholder.style.display = 'none';
                } else {
                    eventImagePreview.src = '';
                    eventImagePreview.style.display = 'none';
                    eventImagePlaceholder.style.display = 'block';
                }
            }

            if (saveEventBtn) saveEventBtn.textContent = 'Actualizar Evento'; 
            showToast("Evento cargado para edición.", "info");

            // Desbloquear todos los campos para edición y cambiar iconos
            if (eventForm) {
                eventForm.querySelectorAll('.input-field-admin').forEach(input => {
                    input.disabled = false;
                    input.classList.remove('input-locked');
                });
                eventForm.querySelectorAll('.btn-edit-field').forEach(btn => {
                    const icon = btn.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-edit');
                        icon.classList.add('fa-lock-open');
                    }
                });
            }

        } else {
            showToast("Evento no encontrado para editar.", "error");
            resetEventForm();
        }
    } catch (error) {
        console.error("Error al cargar el evento para edición:", error);
        showToast('Error al cargar el evento para edición: ' + error.message, 'error');
    }
}

/**
 * Maneja el envío del formulario de agregar/editar evento.
 * @param {Event} e - Evento de envío.
 */
async function handleEventFormSubmit(e) {
    e.preventDefault();

    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        showToast("Error: No estás autenticado como administrador o Firebase no está listo.", "error");
        return;
    }

    if (saveEventBtn) {
        saveEventBtn.disabled = true;
        saveEventBtn.textContent = 'Guardando...';
    }

    const eventId = eventIdInput ? eventIdInput.value : '';
    const isEditing = !!eventId; 

    const eventData = {
        titulo: eventTituloInput ? eventTituloInput.value.trim() : '',
        genero: eventGeneroInput ? eventGeneroInput.value.trim() : '',
        lugar: eventLugarInput ? eventLugarInput.value.trim() : '',
        fecha: eventFechaInput ? new Date(eventFechaInput.value) : null, // Convertir a objeto Date
        precio: eventPrecioInput ? parseFloat(eventPrecioInput.value) : 0,
        descripcion: eventDescripcionInput ? eventDescripcionInput.value.trim() : '',
        imagen: eventImagenUrlInput ? eventImagenUrlInput.value.trim() : '' // URL de la imagen
    };

    // Validaciones
    if (isNaN(eventData.precio)) {
        showToast("El precio debe ser un número válido.", "error");
        if (saveEventBtn) {
            saveEventBtn.disabled = false;
            saveEventBtn.textContent = isEditing ? 'Actualizar Evento' : 'Guardar Evento';
        }
        return;
    }
    if (!eventData.titulo || !eventData.genero || !eventData.lugar || !eventData.fecha || !eventData.descripcion || eventData.imagen === '') {
        showToast("Todos los campos obligatorios (incluida la URL de la imagen) deben ser rellenados.", "error");
        if (saveEventBtn) {
            saveEventBtn.disabled = false;
            saveEventBtn.textContent = isEditing ? 'Actualizar Evento' : 'Guardar Evento';
        }
        return;
    }
    if (!eventData.fecha || isNaN(eventData.fecha.getTime())) {
        showToast("La fecha y hora no son válidas.", "error");
        if (saveEventBtn) {
            saveEventBtn.disabled = false;
            saveEventBtn.textContent = isEditing ? 'Actualizar Evento' : 'Guardar Evento';
        }
        return;
    }

    // Determinar si el precio ha cambiado para requerir justificación
    const priceChanged = isEditing && originalEventData && originalEventData.precio !== eventData.precio;
    let finalEventData = { ...eventData };

    if (priceChanged) {
        const justificationSubmitted = await new Promise(resolve => {
            if (priceJustificationModal) {
                priceJustificationModal.classList.add('flex');
                priceJustificationModal.classList.remove('hidden');
            }
            if (justificationTextarea) justificationTextarea.value = ''; 

            const onSubmit = () => {
                if (submitJustificationBtn) submitJustificationBtn.removeEventListener('click', onSubmit);
                if (cancelJustificationBtn) cancelJustificationBtn.removeEventListener('click', onCancel);
                resolve(true);
            };
            const onCancel = () => {
                if (submitJustificationBtn) submitJustificationBtn.removeEventListener('click', onSubmit);
                if (cancelJustificationBtn) cancelJustificationBtn.removeEventListener('click', onCancel);
                resolve(false);
            };
            if (submitJustificationBtn) submitJustificationBtn.addEventListener('click', onSubmit);
            if (cancelJustificationBtn) cancelJustificationBtn.addEventListener('click', onCancel);
        });

        if (justificationSubmitted) {
            finalEventData.priceChangeJustification = justificationTextarea ? justificationTextarea.value.trim() : '';
            finalEventData.lastPriceChangeBy = currentAuthUser.uid;
        } else {
            showToast("Cambio de precio cancelado. Evento no guardado con nuevo precio.", "info");
            if (saveEventBtn) {
                saveEventBtn.disabled = false;
                saveEventBtn.textContent = isEditing ? 'Actualizar Evento' : 'Guardar Evento';
            }
            if (originalEventData && originalEventData.precio !== undefined && eventPrecioInput) {
                eventPrecioInput.value = originalEventData.precio;
            }
            return; 
        }
    } else if (isEditing) {
        delete finalEventData.priceChangeJustification;
        delete finalEventData.lastPriceChangeBy;
    }
    
    try {
        if (isEditing) {
            const eventDocRef = doc(window.db, 'eventos', eventId); // Colección 'eventos'
            await updateDoc(eventDocRef, finalEventData); 
            showToast("Evento actualizado con éxito.", "success");
        } else {
            const eventsCol = collection(window.db, 'eventos'); // Colección 'eventos'
            const newEventDocRef = await addDoc(eventsCol, {
                ...finalEventData, 
                createdAt: new Date(),
                updatedAt: new Date()
            });
            const newEventId = newEventDocRef.id; 

            // Generar y guardar asientos para el nuevo evento
            const seatsBatch = writeBatch(window.db); 
            const rows = ['A', 'B', 'C', 'D', 'E']; 
            const seatsPerRow = 10; 

            for (const rowLabel of rows) {
                for (let i = 1; i <= seatsPerRow; i++) {
                    const seatId = `seat-${rowLabel}${i}`;
                    const seatRef = doc(collection(window.db, 'eventos', newEventId, 'seats'), seatId);
                    seatsBatch.set(seatRef, {
                        status: 'available', 
                        label: `${rowLabel}${i}`, 
                        row: rowLabel,
                        number: i
                    });
                }
            }
            await seatsBatch.commit();
            showToast("Evento agregado y asientos inicializados con éxito.", "success");
        }

        resetEventForm();
        currentEditingEventId = null;
        if (saveEventBtn) saveEventBtn.textContent = 'Guardar Evento';
        loadEvents(); 
        loadStatistics(); // Recargar estadísticas ya que los eventos cambiaron

    } catch (error) {
        console.error("Error al guardar evento:", error);
        showGenericMessageModal("Error al Guardar Evento", "No se pudo guardar el evento: " + error.message, false);
    } finally {
        if (saveEventBtn) saveEventBtn.disabled = false;
    }
}

/**
 * Elimina un evento de Firestore.
 * @param {string} eventId - ID del evento a eliminar.
 */
async function deleteEvent(eventId) {
    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        showToast("Error: No estás autenticado como administrador o Firebase no está listo.", "error");
        return;
    }

    const confirmed = await showGenericMessageModal("Confirmar Eliminación", "¿Estás seguro de que quieres eliminar este evento? Esta acción no se puede deshacer.", true, "Sí, Eliminar", "Cancelar");
    if (!confirmed) {
        return;
    }

    try {
        const batch = writeBatch(window.db);
        const eventDocRef = doc(window.db, 'eventos', eventId); // Colección 'eventos'

        // Eliminar las compras asociadas a este evento (si las hay)
        // Nota: Asegúrate que tus compras tengan un campo 'eventId' que apunte al ID del evento.
        const purchasesQuery = query(collection(window.db, 'purchases'), where('eventId', '==', eventId));
        const purchasesSnapshot = await getDocs(purchasesQuery);

        purchasesSnapshot.forEach((purchaseDoc) => {
            batch.delete(purchaseDoc.ref);
        });

        // Eliminar también la subcolección 'seats' (asientos) del evento
        const seatsQuery = query(collection(window.db, 'eventos', eventId, 'seats'));
        const seatsSnapshot = await getDocs(seatsQuery);
        seatsSnapshot.forEach((seatDoc) => {
            batch.delete(seatDoc.ref);
        });

        // Eliminar el evento principal
        batch.delete(eventDocRef);

        await batch.commit();

        showToast("Evento, sus asientos y compras asociadas eliminados con éxito.", "success");
        loadEvents(); 
        loadStatistics(); 
        if (currentEditingEventId === eventId) {
            resetEventForm(); 
        }
    } catch (error) {
        console.error("Error al eliminar el evento y sus datos relacionados:", error);
        showGenericMessageModal("Error de Eliminación", "No se pudo eliminar el evento: " + error.message, false);
    }
}

/**
 * Resetea el formulario de eventos a su estado inicial y bloquea campos.
 */
function resetEventForm() {
    if (eventForm) eventForm.reset();
    if (eventIdInput) eventIdInput.value = '';
    currentEditingEventId = null;
    originalEventData = null; 
    
    if (eventForm) {
        eventForm.querySelectorAll('.input-field-admin').forEach(input => {
            input.disabled = true; 
            input.classList.add('input-locked'); 
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


// --- Funciones de Gestión de Usuarios ---

/**
 * Carga y muestra los usuarios desde Firestore.
 */
async function loadUsers() {
    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        console.error("Firestore no está inicializado o el usuario no es admin. No se pueden cargar los usuarios.");
        if (adminUserTableBody) {
            adminUserTableBody.innerHTML = '<tr><td colspan="5" class="error-message active">Error: Firestore no disponible o sin permisos.</td></tr>';
        }
        return;
    }

    try {
        if (adminUserTableBody) adminUserTableBody.innerHTML = '';
        if (noFilteredUsersMessage) noFilteredUsersMessage.style.display = 'none'; // Ocultar mensaje de no usuarios antes de cargar

        const usersCol = collection(window.db, 'users'); 
        const userSnapshot = await getDocs(usersCol);
        
        allUsersData = []; 
        userSnapshot.forEach(doc => {
            const data = doc.data();
            allUsersData.push({
                id: doc.id,
                ...data,
                registeredAt: data.registeredAt ? (data.registeredAt.toDate ? data.registeredAt.toDate() : new Date(data.registeredAt)) : null
            });
        });
        console.log("Todos los usuarios cargados:", allUsersData);
        updateUserSortIcons(); 
        renderUsersTable(allUsersData); 

    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        showGenericMessageModal("Error al Cargar Usuarios", "No se pudieron cargar los usuarios: " + error.message, false);
        if (adminUserTableBody) {
            adminUserTableBody.innerHTML = '<tr><td colspan="5" class="error-message active">Error al cargar usuarios.</td></tr>';
        }
    }
}

/**
 * Actualiza los iconos de ordenación en los encabezados de la tabla de usuarios.
 */
function updateUserSortIcons() {
    if (!adminUserTableHead) return;
    adminUserTableHead.querySelectorAll('th[data-sort]').forEach(header => {
        const icon = header.querySelector('i.fas');
        if (icon) {
            icon.classList.remove('fa-sort-up', 'fa-sort-down');
            icon.classList.add('fa-sort'); 

            if (header.dataset.sort === currentUserSortColumn) {
                icon.classList.remove('fa-sort');
                icon.classList.add(currentUserSortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            }
        }
    });
}

/**
 * Renderiza la tabla de usuarios con los datos proporcionados, aplicando ordenamiento.
 * @param {Array<Object>} usersToRender - Array de objetos de usuario a renderizar.
 */
function renderUsersTable(usersData) {
    if (!adminUserTableBody) return;
    adminUserTableBody.innerHTML = ''; 

    const sortedUsers = [...usersData].sort((a, b) => {
        let valA = a[currentUserSortColumn];
        let valB = b[currentUserSortColumn]; 

        if (currentUserSortColumn === 'registeredAt') {
            valA = valA ? valA.getTime() : 0; 
            valB = valB ? valB.getTime() : 0;
        } 
        else {
            valA = String(valA || '');
            valB = String(valB || '');
        }

        if (valA < valB) {
            return currentUserSortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return currentUserSortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });

    if (sortedUsers.length === 0) {
        if (noFilteredUsersMessage) noFilteredUsersMessage.style.display = 'block';
        return;
    } else {
        if (noFilteredUsersMessage) noFilteredUsersMessage.style.display = 'none';
    }

    sortedUsers.forEach(userData => {
        const row = adminUserTableBody.insertRow();
        row.dataset.id = userData.id; 

        const registeredDate = userData.registeredAt instanceof Date
            ? formatTimestamp(userData.registeredAt) : 'N/A';

        row.innerHTML = `
            <td data-label="Email">${userData.email || 'N/A'}</td>
            <td data-label="UID">${userData.id}</td>
            <td data-label="Nombre">${userData.name || 'N/A'}</td>
            <td data-label="Fecha Registro">${registeredDate}</td>
            <td class="actions" data-label="Acciones">
                <div class="button-group-table">
                    <button class="btn btn-edit btn-small" data-id="${userData.id}" data-action="edit-user">✏️ Editar</button>
                    <!-- Eliminación de usuarios: NOTA DE SEGURIDAD. La eliminación COMPLETA de una cuenta de Firebase Auth
                         (no solo el documento de Firestore) debe realizarse con Firebase Admin SDK en un backend seguro
                         (ej. Cloud Functions) para evitar vulnerabilidades. Aquí solo se elimina el documento de Firestore. -->
                    <button class="btn btn-delete btn-small" data-id="${userData.id}" data-action="delete-user">🗑️ Eliminar</button>
                </div>
            </td>
        `;
    });

    adminUserTableBody.querySelectorAll('[data-action="edit-user"]').forEach(button => {
        button.addEventListener('click', (e) => editUser(e.currentTarget.dataset.id));
    });
    // Habilitar el event listener para el botón de eliminar usuario
    adminUserTableBody.querySelectorAll('[data-action="delete-user"]').forEach(button => {
        button.addEventListener('click', (e) => deleteUser(e.currentTarget.dataset.id));
    });
}

/**
 * Abre el modal de edición de usuario y lo rellena con los datos.
 * @param {string} userId - ID del usuario a editar.
 */
async function editUser(userId) {
    if (!window.db) {
        showToast("Error: Firestore no está inicializado.", "error");
        return;
    }
    try {
        const userDocRef = doc(window.db, 'users', userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (editUserIdInput) editUserIdInput.value = userId;
            if (editUserNameInput) editUserNameInput.value = userData.name || '';
            if (editUserEmailInput) editUserEmailInput.value = userData.email || ''; 
            
            if (editUserModal) {
                editUserModal.classList.add('flex');
                editUserModal.classList.remove('hidden');
            }
        } else {
            showToast("Usuario no encontrado para editar.", "error");
        }
    } catch (error) {
        console.error("Error al cargar usuario para edición:", error);
        showGenericMessageModal("Error", "No se pudo cargar el usuario para editar: " + error.message, false);
    }
}

/**
 * Maneja el envío del formulario de edición de usuario.
 */
async function handleEditUserFormSubmit(e) {
    e.preventDefault();

    const userId = editUserIdInput ? editUserIdInput.value : '';
    const newName = editUserNameInput ? editUserNameInput.value.trim() : '';

    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        showToast("Error: No estás autenticado como administrador o Firebase no está listo.", "error");
        return;
    }

    try {
        const userDocRef = doc(window.db, 'users', userId);
        const updates = {};

        if (newName) {
            updates.name = newName;
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(userDocRef, updates);
            showToast("Perfil de usuario actualizado en Firestore.", "success");
            loadUsers(); 
        } else {
            showToast("No hay cambios para guardar.", "info");
        }

        if (userId === currentAuthUser.uid && newName && currentAuthUser.displayName !== newName) {
            try {
                await updateProfile(currentAuthUser, { displayName: newName });
                console.log("Nombre de usuario de Auth actualizado para el admin actual.");
            } catch (profileError) {
                console.warn("No se pudo actualizar el perfil de Auth del admin actual (nombre):", profileError);
                showToast("Advertencia: No se pudo actualizar el nombre en el perfil de autenticación. " + profileError.message, "warning");
            }
        }

        if (editUserModal) {
            editUserModal.classList.remove('flex');
            editUserModal.classList.add('hidden');
        }
        if (editUserForm) editUserForm.reset();

    } catch (error) {
        console.error("Error al guardar cambios del usuario:", error);
        showGenericMessageModal("Error al Guardar Cambios", "No se pudieron guardar los cambios del usuario: " + error.message, false);
    }
}


/**
 * Elimina un usuario.
 * Nota: La eliminación completa de usuarios (incluyendo Auth) debe hacerse desde un backend seguro
 * (ej. Cloud Functions) usando el Admin SDK de Firebase.
 * @param {string} userId - ID del usuario a eliminar.
 */
async function deleteUser(userId) {
    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        showToast("Error: No estás autenticado como administrador o Firebase no está listo.", "error");
        return;
    }

    if (userId === ADMIN_UID) {
        showGenericMessageModal("Operación no permitida", "No puedes eliminar tu propia cuenta de administrador.", false);
        return;
    }

    const confirmed = await showGenericMessageModal("Confirmar Eliminación", `¿Estás seguro de que quieres eliminar al usuario ${userId}? Esta acción solo eliminará el documento del usuario en Firestore. Para la eliminación COMPLETA del usuario (incluyendo autenticación), se requiere una función de backend.`, true, "Sí, Eliminar Documento", "Cancelar");
    if (!confirmed) {
        return;
    }

    try {
        const userDocRef = doc(window.db, 'users', userId);
        await deleteDoc(userDocRef);
        
        showToast(`Documento de usuario "${userId}" eliminado de Firestore. Recuerda que la eliminación completa del usuario (incluyendo autenticación) se haría con una función de backend.`, "success", 7000);
        console.log(`Eliminado documento de usuario: ${userId}.`);

        loadUsers(); 
        
    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        showGenericMessageModal("Error de Eliminación", "No se pudo eliminar el documento del usuario: " + error.message, false);
    }
}


// --- Funciones de Estadísticas/Analíticas ---

/**
 * Carga y muestra las estadísticas generales de la aplicación.
 */
async function loadStatistics() {
    if (!window.db || !currentAuthUser || currentAuthUser.uid !== ADMIN_UID) {
        console.error("Firestore no está inicializado o el usuario no es admin. No se pueden cargar las estadísticas.");
        if (statTotalEvents) statTotalEvents.textContent = 'Error';
        if (statTotalUsers) statTotalUsers.textContent = 'Error';
        if (statTicketsSold) statTicketsSold.textContent = 'Error';
        if (statTotalRevenue) statTotalRevenue.textContent = 'Error';
        if (statTopEventsTableBody) statTopEventsTableBody.innerHTML = '<tr><td colspan="3" class="error-message active">Error al cargar estadísticas.</td></tr>';
        return;
    }

    if (statTotalEvents) statTotalEvents.textContent = 'Cargando...';
    if (statTotalUsers) statTotalUsers.textContent = 'Cargando...';
    if (statTicketsSold) statTicketsSold.textContent = 'Cargando...';
    if (statTotalRevenue) statTotalRevenue.textContent = 'Cargando...';
    if (statTopEventsTableBody) statTopEventsTableBody.innerHTML = ''; 
    if (noTopEventsMessage) noTopEventsMessage.style.display = 'none';

    try {
        // Contar Eventos
        const eventsSnapshot = await getDocs(collection(window.db, 'eventos')); // Colección 'eventos'
        if (statTotalEvents) statTotalEvents.textContent = eventsSnapshot.size;

        // Contar Usuarios
        const usersSnapshot = await getDocs(collection(window.db, 'users'));
        if (statTotalUsers) statTotalUsers.textContent = usersSnapshot.size;

        // Calcular Entradas Vendidas e Ingresos Totales
        const purchasesColRef = collection(window.db, 'purchases'); 
        const purchasesSnapshot = await getDocs(purchasesColRef);
        
        let totalTickets = 0;
        let totalRevenue = 0;
        const eventSales = {}; 

        if (purchasesSnapshot.empty) {
            console.log("No se encontraron documentos en la colección de compras.");
            if (noTopEventsMessage) noTopEventsMessage.style.display = 'block';
        } else {
            console.log(`Se encontraron ${purchasesSnapshot.size} documentos de compras.`);
            purchasesSnapshot.forEach(doc => {
                const purchaseData = doc.data();
                const quantity = purchaseData.quantity || 0;
                const totalAmount = purchaseData.totalAmount || 0;
                const eventId = purchaseData.eventId;
                const eventTitle = purchaseData.eventTitle || 'Evento Desconocido';

                totalTickets += quantity;
                totalRevenue += totalAmount;

                if (!eventSales[eventId]) {
                    eventSales[eventId] = { tickets: 0, revenue: 0, title: eventTitle };
                }
                eventSales[eventId].tickets += quantity;
                eventSales[eventId].revenue += totalAmount;
            });

            if (statTicketsSold) statTicketsSold.textContent = totalTickets;
            if (statTotalRevenue) statTotalRevenue.textContent = `CLP$${totalRevenue.toFixed(0)}`;

            const sortedEvents = Object.values(eventSales).sort((a, b) => b.revenue - a.revenue); 
            
            if (sortedEvents.length > 0) {
                // Limpiar tabla antes de añadir nuevos datos
                if (statTopEventsTableBody) statTopEventsTableBody.innerHTML = ''; 
                sortedEvents.forEach(eventStat => {
                    const row = statTopEventsTableBody.insertRow();
                    row.innerHTML = `
                        <td>${eventStat.title}</td>
                        <td>${eventStat.tickets}</td>
                        <td>CLP$${eventStat.revenue.toFixed(0)}</td>
                    `;
                });
            } else {
                if (noTopEventsMessage) noTopEventsMessage.style.display = 'block';
            }
        }
    } catch (error) {
        console.error("Error al cargar estadísticas:", error);
        showGenericMessageModal("Error al Cargar Estadísticas", "No se pudieron cargar las estadísticas: " + error.message, false);
        if (statTotalEvents) statTotalEvents.textContent = 'Error';
        if (statTotalUsers) statTotalUsers.textContent = 'Error';
        if (statTicketsSold) statTicketsSold.textContent = 'Error';
        if (statTotalRevenue) statTotalRevenue.textContent = 'Error';
        if (statTopEventsTableBody) statTopEventsTableBody.innerHTML = '<tr><td colspan="3" class="error-message active">Error al cargar estadísticas.</td></tr>';
    }
}
