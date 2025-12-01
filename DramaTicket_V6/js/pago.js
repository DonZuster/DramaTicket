// js/pago.js
// Este archivo ahora maneja la selección interactiva de asientos y el resumen de la compra.
// La compra final con transacción se realiza en payment-details.js.

import { auth, db } from './firebase-init.js'; // Importa auth y db
import { doc, getDoc, collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast, formatTimestamp, createElement } from './utils.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';


// Elementos del DOM para el resumen del evento
const eventTitleSpan = document.getElementById('event-title');
const eventDateSpan = document.getElementById('event-date');
const eventLocationSpan = document.getElementById('event-location');
const eventPriceSpan = document.getElementById('event-price');

// Elementos del DOM para la selección de asientos
const seatMapContainer = document.getElementById('seat-map');
const selectedSeatsCountSpan = document.getElementById('selected-seats-count');
const totalAmountSpan = document.getElementById('total-amount');
const seatSelectionMessage = document.getElementById('seat-selection-message'); // Mensaje de feedback para asientos

// Botones y mensajes
const continueToPaymentBtn = document.getElementById('continue-to-payment-btn');
const paymentErrorMessage = document.getElementById('payment-error-message');

let currentEvent = null; // Almacenará los datos del evento cargados
let selectedSeats = new Set(); // Almacena los IDs de los asientos seleccionados (ej. 'seat-A1')
const totalSeats = 50; // Número fijo de asientos para demostración (ej. 5 filas de 10 asientos)
let currentUser = null; // Para almacenar el usuario autenticado

document.addEventListener('DOMContentLoaded', async () => {
    console.log("pago.js: DOMContentLoaded - Iniciando carga de página de pago.");

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        showToast('Error: ID de evento no proporcionado. Redirigiendo.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        return;
    }

    // Cargar datos del evento desde sessionStorage (desde evento.js)
    const storedEventData = sessionStorage.getItem('currentEventForSeats');
    if (storedEventData) {
        currentEvent = JSON.parse(storedEventData);
        // Convertir la fecha de nuevo a objeto Date si es necesario para formatTimestamp
        if (currentEvent.fecha && typeof currentEvent.fecha === 'string') {
            currentEvent.fecha = new Date(currentEvent.fecha);
        }
        updateEventSummaryUI();
    } else {
        // Si no hay datos en sessionStorage, intentar cargar directamente de Firestore (menos óptimo pero fallback)
        await loadEventDetailsFromFirestore(eventId);
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user || user.isAnonymous) {
            const currentUrl = window.location.href;
            window.location.href = `login.html?redirect=${encodeURIComponent(currentUrl)}`;
            return;
        }

        // Guardamos el usuario autenticado
        currentUser = user;

        // Si todavía no tenemos el evento (por ejemplo porque no venía en sessionStorage),
        // lo cargamos desde Firestore
        if (!currentEvent) {
            await loadEventDetailsFromFirestore(eventId);
        }

        // Cuando ya tenemos currentEvent, recién ahí renderizamos los asientos
        if (currentEvent && currentEvent.id) {
            renderSeats(currentEvent.id);
        } else {
            console.error("pago.js: No se pudo obtener el ID del evento para renderizar asientos.");
        }
    });



    if (continueToPaymentBtn) { 
        continueToPaymentBtn.addEventListener('click', handleContinueToPayment);
    }
});

/**
 * Carga los detalles del evento desde Firestore si no están en sessionStorage.
 * @param {string} eventId - El ID del evento a cargar.
 */
async function loadEventDetailsFromFirestore(eventId) {
    if (!db) {
        showToast("Error: Firestore no está inicializado.", "error");
        return;
    }
    try {
        const eventDocRef = doc(db, 'eventos', eventId);
        const eventDocSnap = await getDoc(eventDocRef);

        if (eventDocSnap.exists()) {
            currentEvent = { id: eventDocSnap.id, ...eventDocSnap.data() };
            // Asegurarse de que la fecha sea un objeto Date
            if (currentEvent.fecha && typeof currentEvent.fecha.toDate === 'function') {
                currentEvent.fecha = currentEvent.fecha.toDate();
            }
            updateEventSummaryUI();
        } else {
            showToast('Evento no encontrado. Redirigiendo.', 'error');
            setTimeout(() => { window.location.href = 'index.html'; }, 2000);
        }
    } catch (error) {
        console.error("Error al cargar el evento desde Firestore:", error);
        showToast('Error al cargar los detalles del evento.', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 2000);
    }
}

/**
 * Actualiza la UI con los detalles del evento.
 */
function updateEventSummaryUI() {
    if (currentEvent) {
        if (eventTitleSpan) eventTitleSpan.textContent = currentEvent.titulo;
        if (eventDateSpan) eventDateSpan.textContent = formatTimestamp(currentEvent.fecha);
        if (eventLocationSpan) eventLocationSpan.textContent = currentEvent.lugar;
        if (eventPriceSpan) eventPriceSpan.textContent = `CLP$${currentEvent.precio.toFixed(0)}`;
        console.log("pago.js: Resumen de compra actualizado para el evento:", currentEvent.titulo);
    }
}


/**
 * Renderiza el mapa de asientos y escucha cambios en tiempo real.
 * @param {string} currentEventId - ID del evento para cargar sus asientos.
 */
async function renderSeats(currentEventId) {
    if (!seatMapContainer || !db) {
        console.warn("Contenedor de asientos o Firestore no encontrado en renderSeats.");
        return;
    }

    const seatsGrid = seatMapContainer.querySelector('.seats-grid');
    if (!seatsGrid) {
        console.error("Elemento .seats-grid no encontrado dentro de #seat-map. Asegúrate de que pago.html lo contenga.");
        return;
    }
    
    // Escucha en tiempo real los cambios en la subcolección 'seats'
    const seatsCollectionRef = collection(db, 'eventos', currentEventId, 'seats');
    
    onSnapshot(seatsCollectionRef, (snapshot) => {
        const bookedSeats = new Set();
        
        snapshot.forEach(doc => {
            const seatData = doc.data();

            // AHORA (incluimos 'occupied'):
            if (
                seatData.status === 'occupied' ||  // asientos ya comprados
                seatData.status === 'booked'   ||  // por si tienes lógica antigua
                seatData.status === 'purchased'    // idem
            ) {
                bookedSeats.add(doc.id);
            }
        });

        console.log("pago.js: Asientos ocupados actualizados (onSnapshot):", Array.from(bookedSeats));

        const previouslySelectedSeats = new Set(selectedSeats); // Guardar selección actual antes de limpiar
        selectedSeats.clear(); // Limpiar antes de redibujar para evitar desincronización
        seatsGrid.innerHTML = ''; // Limpiar el grid para redibujar

        const rows = ['A', 'B', 'C', 'D', 'E']; // Filas de asientos (5 filas de 10 asientos)
        const seatsPerRow = 10; // 10 asientos por fila

        for (let r = 0; r < rows.length; r++) {
            const rowLabel = rows[r];
            const rowContainer = createElement('div', ['seat-row']);
            if (rowContainer) { 
                rowContainer.innerHTML = `<span class="row-label">${rowLabel}</span>`; // Etiqueta de fila
            }

            for (let s = 1; s <= seatsPerRow; s++) {
                const seatId = `${rowLabel}${s}`; // Ej. A1, B5 (sin prefijo "seat-")
                const fullSeatId = `seat-${seatId}`; // Para comparar con Firestore (que sigue usando "seat-A1")

                const seatElement = createElement('div', ['seat'], { 'data-seat-id': seatId });
                if (seatElement) { 
                    seatElement.textContent = s; // Solo el número del asiento

                    if (bookedSeats.has(fullSeatId)) { // Compara con el formato de Firestore
                        seatElement.classList.add('occupied');
                        seatElement.title = 'Asiento ocupado';
                        previouslySelectedSeats.delete(seatId); 
                    } else {
                        seatElement.classList.add('available');
                        if (currentUser && !currentUser.isAnonymous) {
                            seatElement.addEventListener('click', () => toggleSeatSelection(seatId, seatElement));
                        } else {
                            seatElement.title = 'Inicia sesión para seleccionar';
                            seatElement.addEventListener('click', () => showToast("Debes iniciar sesión para seleccionar asientos.", "info"));
                        }
                    }
                    
                    if (previouslySelectedSeats.has(seatId) && !bookedSeats.has(fullSeatId)) {
                        seatElement.classList.add('selected');
                        selectedSeats.add(seatId);
                    }
                    if (rowContainer) { 
                        rowContainer.appendChild(seatElement);
                    }
                }
            }
            if (seatsGrid && rowContainer) { 
                seatsGrid.appendChild(rowContainer);
            }
        }
        updateSummaryAndUI();
    }, (error) => {
        console.error("Error al escuchar cambios en los asientos:", error);
        showToast("Error al cargar los asientos disponibles.", "error");
    });
}

/**
 * Alterna la selección de un asiento.
 * @param {string} seatId - El ID del asiento (ej. 'A1').
 * @param {HTMLElement} seatElement - El elemento DOM del asiento.
 */
function toggleSeatSelection(seatId, seatElement) {
    if (seatElement.classList.contains('occupied')) {
        return;
    }
    if (!currentUser || currentUser.isAnonymous) {
        showToast("Debes iniciar sesión para seleccionar asientos.", "info");
        return;
    }

    if (selectedSeats.has(seatId)) {
        seatElement.classList.remove('selected');
        seatElement.classList.add('available');
        selectedSeats.delete(seatId);
        console.log("Asiento deseleccionado:", seatId);
    } else {
        seatElement.classList.add('selected');
        seatElement.classList.remove('available');
        selectedSeats.add(seatId);
        console.log("Asiento seleccionado:", seatId);
    }
    updateSummaryAndUI();
}

/**
 * Actualiza el resumen de asientos seleccionados y el monto total.
 */
function updateSummaryAndUI() {
    if (selectedSeatsCountSpan) selectedSeatsCountSpan.textContent = selectedSeats.size;
    if (totalAmountSpan && currentEvent) {
        const total = selectedSeats.size * currentEvent.precio;
        totalAmountSpan.textContent = `CLP$${total.toFixed(0)}`;
    }
    updateUIBasedOnAuth();
}

/**
 * Actualiza la visibilidad y estado del botón "Continuar a Pago" basado en la autenticación y selección de asientos.
 */
function updateUIBasedOnAuth() {
    if (continueToPaymentBtn) {
        if (currentUser && !currentUser.isAnonymous && selectedSeats.size > 0) {
            continueToPaymentBtn.disabled = false;
            continueToPaymentBtn.textContent = `Continuar a Pago (${selectedSeats.size} entradas)`;
            if (seatSelectionMessage) {
                seatSelectionMessage.textContent = '¡Asientos seleccionados! Presiona "Continuar a Pago"';
                seatSelectionMessage.classList.remove('error-message');
                seatSelectionMessage.classList.add('info-message');
            }

        } else {
            continueToPaymentBtn.disabled = true;
            if (!currentUser || currentUser.isAnonymous) {
                continueToPaymentBtn.textContent = 'Inicia sesión para continuar';
                if (seatSelectionMessage) {
                    seatSelectionMessage.textContent = 'Debes iniciar sesión para seleccionar asientos y continuar.';
                    seatSelectionMessage.classList.remove('info-message');
                    seatSelectionMessage.classList.add('error-message');
                }
            } else if (selectedSeats.size === 0) {
                continueToPaymentBtn.textContent = 'Selecciona asientos para continuar';
                if (seatSelectionMessage) {
                    seatSelectionMessage.textContent = 'Por favor, selecciona al menos un asiento para continuar.';
                    seatSelectionMessage.classList.remove('info-message');
                    seatSelectionMessage.classList.add('error-message');
                }
            }
        }
    }
}


/**
 * Maneja el clic del botón "Continuar a Pago".
 * Guarda los datos finales de la compra en sessionStorage y redirige a payment-details.html.
 */
function handleContinueToPayment() {
    if (!currentEvent || selectedSeats.size === 0 || !currentUser || currentUser.isAnonymous) {
        showToast('Por favor, selecciona al menos un asiento y asegúrate de haber iniciado sesión.', 'error');
        return;
    }

    // Prepara los datos finales de la compra para la siguiente página
    const purchaseData = {
        eventId: currentEvent.id,
        eventTitle: currentEvent.titulo,
        eventDate: currentEvent.fecha.toISOString(), // Guarda como ISO string
        eventLocation: currentEvent.lugar,
        ticketPrice: currentEvent.precio,
        selectedSeats: Array.from(selectedSeats).sort(), // Guarda los IDs sin "seat-"
        quantity: selectedSeats.size,
        totalAmount: selectedSeats.size * currentEvent.precio,
        userId: currentUser.uid 
    };

    try {
        sessionStorage.setItem('currentPurchase', JSON.stringify(purchaseData));
        console.log("pago.js: Datos de compra final guardados en sessionStorage con clave 'currentPurchase' y redirigiendo a payment-details.html");
        window.location.href = 'payment-details.html';
    } catch (e) {
        console.error("pago.js: Error al guardar en sessionStorage:", e);
        showToast('Error al preparar la compra. Por favor, intente de nuevo.', 'error');
    }
}
