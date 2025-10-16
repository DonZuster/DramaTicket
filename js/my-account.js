// js/my-account.js
import { auth, db } from './firebase-init.js'; // Importa auth y db
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged, updateProfile, updateEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { createElement, formatTimestamp, showToast, showGenericMessageModal } from './utils.js';

// Elementos del DOM
const accountAuthStatus = document.getElementById('account-auth-status');
const accountDetailsSection = document.getElementById('account-details-section');
const myPurchasesSection = document.getElementById('my-purchases-section');

const userEmailSpan = document.getElementById('user-email');
const userNameSpan = document.getElementById('user-name'); 
const userRegisteredDateSpan = document.getElementById('user-registered-date');
const purchasesTableBody = document.querySelector('#purchases-table tbody');
const noPurchasesMessage = document.getElementById('no-purchases-message');

const editProfileBtn = document.getElementById('edit-profile-btn');
const editProfileSection = document.getElementById('edit-profile-section');
const editProfileForm = document.getElementById('edit-profile-form');
const editNameInput = document.getElementById('edit-name');
const editEmailInput = document.getElementById('edit-email');
const cancelEditProfileBtn = document.getElementById('cancel-edit-profile-btn');
const editProfileMessage = document.getElementById('edit-profile-message');

let currentUserData = null; // Para almacenar los datos del perfil del usuario
let allUserPurchases = []; // Para almacenar todas las compras del usuario

// Estado de ordenación
let currentSortColumn = 'purchaseDate'; // Columna de ordenación inicial
let currentSortDirection = 'desc'; // Dirección de ordenación inicial (descendente)

document.addEventListener('DOMContentLoaded', () => {
    console.log("my-account.js: DOMContentLoaded - Iniciando.");

    // Esperar a que Firebase Auth y Firestore estén inicializados globalmente
    const checkFirebaseReady = setInterval(() => {
        if (typeof auth !== 'undefined' && typeof db !== 'undefined') {
            clearInterval(checkFirebaseReady); // Detener el chequeo
            console.log("my-account.js: Firebase Auth y Firestore disponibles.");

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    console.log("my-account.js: Usuario autenticado:", user.uid);
                    accountAuthStatus.textContent = '¡Has iniciado sesión!';
                    accountAuthStatus.classList.remove('info-message', 'error-message');
                    accountAuthStatus.classList.add('success-message');

                    // Cargar y mostrar datos del perfil
                    await loadUserProfile(user);

                    // Cargar y mostrar compras del usuario (con listener en tiempo real)
                    listenToUserPurchases(user.uid);

                    // Mostrar secciones si el usuario está autenticado
                    accountDetailsSection.style.display = 'block';
                    myPurchasesSection.style.display = 'block';

                } else {
                    console.log("my-account.js: Usuario no autenticado.");
                    accountAuthStatus.textContent = 'Debes iniciar sesión para ver los detalles de tu cuenta.';
                    accountAuthStatus.classList.remove('info-message', 'success-message');
                    accountAuthStatus.classList.add('error-message');

                    // Ocultar secciones si el usuario no está autenticado
                    accountDetailsSection.style.display = 'none';
                    myPurchasesSection.style.display = 'none';
                    showToast("Debes iniciar sesión para ver tu cuenta.", "info");

                    // Opcional: redirigir a la página de login
                    // setTimeout(() => { window.location.href = 'login.html'; }, 2000);
                }
            });

            // Event Listeners para edición de perfil
            if (editProfileBtn) {
                editProfileBtn.addEventListener('click', () => {
                    accountDetailsSection.style.display = 'none';
                    editProfileSection.style.display = 'block';
                    // Rellenar el formulario con los datos actuales
                    if (currentUserData) {
                        editNameInput.value = currentUserData.name || '';
                        editEmailInput.value = currentUserData.email || '';
                    }
                });
            }

            if (cancelEditProfileBtn) {
                cancelEditProfileBtn.addEventListener('click', () => {
                    editProfileSection.style.display = 'none';
                    accountDetailsSection.style.display = 'block';
                    editProfileMessage.textContent = ''; // Limpiar mensaje de edición
                    editProfileMessage.classList.remove('active', 'success-message', 'error-message', 'info-message');
                });
            }

            if (editProfileForm) {
                editProfileForm.addEventListener('submit', handleEditProfileSubmit);
            }

            // Event Listeners para las cabeceras de la tabla para ordenar
            document.querySelectorAll('#purchases-table th[data-sort]').forEach(header => {
                header.style.cursor = 'pointer'; // Indicar que es clickeable
                header.addEventListener('click', (e) => {
                    const column = e.currentTarget.dataset.sort;
                    toggleSort(column);
                });
            });

        } else {
            console.warn("my-account.js: Firebase Auth o Firestore no están disponibles aún.");
        }
    }, 100); // Chequear cada 100ms
});

/**
 * Carga los datos del perfil del usuario desde Firestore.
 * @param {Object} user - El objeto de usuario de Firebase Auth.
 */
async function loadUserProfile(user) {
    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            currentUserData = userDocSnap.data();
            currentUserData.email = user.email; // Asegurar que el email del auth esté presente
            console.log("my-account.js: Datos de perfil de usuario cargados:", currentUserData);

            if (userEmailSpan) userEmailSpan.textContent = currentUserData.email || 'N/A';
            if (userNameSpan) userNameSpan.textContent = currentUserData.name || 'N/A';
            if (userRegisteredDateSpan) userRegisteredDateSpan.textContent = currentUserData.createdAt ? formatTimestamp(currentUserData.createdAt.toDate()) : 'N/A';
        } else {
            console.warn("my-account.js: No se encontraron datos de perfil en Firestore para el usuario:", user.uid, ". Usando solo datos de Auth.");
            currentUserData = { email: user.email, name: user.displayName || 'Usuario', createdAt: user.metadata.creationTime ? new Date(user.metadata.creationTime) : null };
            if (userEmailSpan) userEmailSpan.textContent = currentUserData.email;
            if (userNameSpan) userNameSpan.textContent = currentUserData.name;
            if (userRegisteredDateSpan) userRegisteredDateSpan.textContent = currentUserData.createdAt ? formatTimestamp(currentUserData.createdAt) : 'N/A';
        }
    } catch (error) {
        console.error("my-account.js: Error al cargar el perfil del usuario:", error);
        showToast("Error al cargar los datos de tu perfil. " + error.message, "error");
    }
}

/**
 * Maneja el envío del formulario de edición de perfil.
 * @param {Event} e - El evento de envío del formulario.
 */
async function handleEditProfileSubmit(e) {
    e.preventDefault();

    const newName = editNameInput.value.trim();
    // const newEmail = editEmailInput.value.trim(); // Email no editable por ahora

    if (!newName) {
        displayEditProfileMessage("El nombre no puede estar vacío.", "error");
        return;
    }

    if (!auth.currentUser) {
        displayEditProfileMessage("No hay usuario autenticado para actualizar.", "error");
        return;
    }

    try {
        // Actualizar perfil de Auth (solo nombre de pantalla)
        if (auth.currentUser.displayName !== newName) {
            await updateProfile(auth.currentUser, {
                displayName: newName
            });
            console.log("my-account.js: Nombre de perfil de Auth actualizado.");
        }

        // Actualizar documento de usuario en Firestore
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await updateDoc(userDocRef, {
            name: newName
        });
        console.log("my-account.js: Nombre de usuario en Firestore actualizado.");

        // Actualizar el email (opcional y más complejo)
        // if (auth.currentUser.email !== newEmail) {
        //     await updateEmail(auth.currentUser, newEmail);
        //     console.log("my-account.js: Correo electrónico de Auth actualizado.");
        // }

        displayEditProfileMessage("¡Perfil actualizado con éxito!", "success");
        // Recargar el perfil para que los cambios se reflejen inmediatamente
        await loadUserProfile(auth.currentUser); 

        // Opcional: Volver a la vista de detalles después de un tiempo
        setTimeout(() => {
            editProfileSection.style.display = 'none';
            accountDetailsSection.style.display = 'block';
            editProfileMessage.textContent = ''; // Limpiar mensaje
            editProfileMessage.classList.remove('active', 'success-message', 'error-message', 'info-message');
        }, 2000);

    } catch (error) {
        console.error("my-account.js: Error al actualizar el perfil:", error);
        // Errores específicos de Auth (ej. auth/requires-recent-login)
        let errorMessage = "Error al actualizar el perfil. Por favor, intente de nuevo.";
        if (error.code === 'auth/requires-recent-login') {
            errorMessage = "Por favor, inicia sesión de nuevo para actualizar tu perfil por seguridad.";
        } else if (error.message) {
            errorMessage += " " + error.message;
        }
        displayEditProfileMessage(errorMessage, "error");
    }
}

/**
 * Muestra un mensaje en la sección de edición de perfil.
 * @param {string} message - El texto del mensaje.
 * @param {string} type - El tipo de mensaje ('success', 'error', 'info').
 */
function displayEditProfileMessage(message, type) {
    if (editProfileMessage) {
        editProfileMessage.textContent = message;
        editProfileMessage.classList.remove('success-message', 'error-message', 'info-message');
        editProfileMessage.classList.add(type + '-message', 'active');
    }
    showToast(message, type);
}


/**
 * Escucha las compras del usuario en tiempo real.
 * @param {string} userId - El ID del usuario actual.
 */
function listenToUserPurchases(userId) {
    if (!db) {
        console.error("Firestore no está inicializado. No se pueden escuchar las compras.");
        return;
    }

    const purchasesColRef = collection(db, 'purchases');
    // Consulta para obtener compras del usuario actual, ordenadas por fecha de compra
    const q = query(purchasesColRef, where('userId', '==', userId));

    onSnapshot(q, (snapshot) => {
        const purchases = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            purchases.push({
                id: doc.id,
                ...data,
                // Convertir Timestamps de Firestore a objetos Date de JS si existen
                eventDate: data.eventDate ? (data.eventDate.toDate ? data.eventDate.toDate() : new Date(data.eventDate)) : null,
                purchaseDate: data.purchaseDate ? (data.purchaseDate.toDate ? data.purchaseDate.toDate() : new Date(data.purchaseDate)) : null,
            });
        });
        allUserPurchases = purchases; // Almacenar todas las compras
        console.log("my-account.js: Compras de usuario actualizadas (tiempo real):", allUserPurchases);
        renderPurchasesTable(); // Redibujar la tabla con los datos actualizados y ordenados
    }, (error) => {
        console.error("my-account.js: Error al escuchar compras del usuario:", error);
        showToast("Error al cargar tus compras: " + error.message, "error");
        if (purchasesTableBody) {
            purchasesTableBody.innerHTML = `<tr><td colspan="6" class="error-message active">Error al cargar tus compras: ${error.message}</td></tr>`;
        }
    });
}

/**
 * Alterna la dirección de ordenación para una columna específica.
 * @param {string} column - La columna por la que se desea ordenar.
 */
function toggleSort(column) {
    if (currentSortColumn === column) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortColumn = column;
        currentSortDirection = 'asc'; // Por defecto a ascendente cuando se cambia de columna
    }
    renderPurchasesTable(); // Volver a renderizar la tabla con la nueva ordenación
}


/**
 * Renderiza la tabla de compras del usuario con los datos actuales.
 */
function renderPurchasesTable() {
    // Envuelve todo el contenido de la función en un bloque try...catch
    try { 
        if (purchasesTableBody) {
            purchasesTableBody.innerHTML = ''; // Limpiar tabla actual

            if (allUserPurchases.length === 0) {
                noPurchasesMessage.style.display = 'block';
                purchasesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No hay compras registradas.</td></tr>';
                return;
            } else {
                noPurchasesMessage.style.display = 'none';
            }

            // Ordenar las compras
            const sortedPurchases = [...allUserPurchases].sort((a, b) => {
                let valA, valB;

                switch (currentSortColumn) {
                    case 'eventTitle':
                        valA = a.eventTitle ? a.eventTitle.toLowerCase() : '';
                        valB = b.eventTitle ? b.eventTitle.toLowerCase() : '';
                        break;
                    case 'eventDate':
                    case 'purchaseDate':
                        valA = a[currentSortColumn] ? a[currentSortColumn].getTime() : 0; // Convertir a timestamp numérico
                        valB = b[currentSortColumn] ? b[currentSortColumn].getTime() : 0;
                        break;
                    case 'quantity':
                    case 'totalAmount':
                        valA = a[currentSortColumn] || 0;
                        valB = b[currentSortColumn] || 0;
                        break;
                    default:
                        // Si la columna no es reconocible, ordenar por purchaseDate (fecha de compra)
                        valA = a.purchaseDate ? a.purchaseDate.getTime() : 0;
                        valB = b.purchaseDate ? b.purchaseDate.getTime() : 0;
                        break;
                }

                if (valA < valB) {
                    return currentSortDirection === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return currentSortDirection === 'asc' ? 1 : -1;
                }
                return 0; // Son iguales
            });


            // Actualizar los íconos de ordenación en las cabeceras
            document.querySelectorAll('#purchases-table th .sort-icon').forEach(iconSpan => {
                const column = iconSpan.dataset.column;
                iconSpan.innerHTML = '<i class="fas fa-sort"></i>'; // Resetear a icono por defecto

                if (column === currentSortColumn) {
                    if (currentSortDirection === 'asc') {
                        iconSpan.innerHTML = '<i class="fas fa-sort-up"></i>'; // Flecha hacia arriba
                    } else {
                        iconSpan.innerHTML = '<i class="fas fa-sort-down"></i>'; // Flecha hacia abajo
                    }
                }
            });


            // Rellenar la tabla con los datos ordenados
            sortedPurchases.forEach(purchaseData => {
                // Formatear fechas para visualización
                const formattedEventDate = purchaseData.eventDate
                    ? formatTimestamp(purchaseData.eventDate) : 'Fecha Inválida';
                
                const formattedPurchaseDate = purchaseData.purchaseDate
                    ? formatTimestamp(purchaseData.purchaseDate) : 'Fecha Inválida';

                const row = createElement('tr', [], {}, [
                    createElement('td', [], {}, purchaseData.eventTitle || 'N/A'),
                    createElement('td', [], {}, formattedEventDate),
                    createElement('td', [], {}, (purchaseData.quantity || 0).toString()), 
                    createElement('td', [], {}, `CLP$${purchaseData.totalAmount ? purchaseData.totalAmount.toFixed(0) : '0'}`),
                    createElement('td', [], {}, formattedPurchaseDate),
                    createElement('td', ['actions'], {}, [
                        // Asegúrate de que purchaseData.eventId esté disponible y sea correcto
                        createElement('a', ['btn-details', 'btn-small'], { href: `evento.html?id=${purchaseData.eventId}` }, 'Ver Evento')
                    ])
                ]);
                purchasesTableBody.appendChild(row);
            });
        }
    } catch (error) { // <-- Bloque catch correcto
        console.error("my-account.js: Error al renderizar compras del usuario:", error);
        if (purchasesTableBody) {
            purchasesTableBody.innerHTML = `<tr><td colspan="6" class="error-message active">Error al cargar tus compras: ${error.message}</td></tr>`;
        }
    }
}
