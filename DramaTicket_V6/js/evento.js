// js/evento.js
import { db, auth } from './firebase-init.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast, formatTimestamp } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    const eventDetailContainer = document.getElementById('event-detail');
    let buyTicketsBtn = null; // Se asignará después de cargar los detalles

    if (!eventId) {
        if (eventDetailContainer) {
            eventDetailContainer.innerHTML = '<p>Evento no encontrado. Vuelve a la <a href="index.html">página principal</a>.</p>';
        }
        return;
    }

    // Cargar detalles del evento
    async function loadEventDetails() {
        if (!db) {
            console.error("Error: Firestore no está inicializado en evento.js.");
            if (eventDetailContainer) {
                eventDetailContainer.innerHTML = '<p>Error al cargar los detalles del evento. Por favor, revise la consola para más detalles.</p>';
            }
            return;
        }
        try {
            const eventDocRef = doc(db, 'eventos', eventId);
            const eventDocSnap = await getDoc(eventDocRef);

            if (eventDocSnap.exists()) {
                const currentEventData = { id: eventDocSnap.id, ...eventDocSnap.data() }; // Guardar el ID también
                if (!currentEventData.fecha || typeof currentEventData.fecha.toDate !== 'function') {
                    console.error(`Error: El evento con ID ${eventId} tiene un campo 'fecha' inválido o no es un Timestamp.`);
                    if (eventDetailContainer) {
                        eventDetailContainer.innerHTML = '<p>Error: Datos del evento incompletos o incorrectos. Revise el campo "fecha" en Firestore.</p>';
                    }
                    return;
                }

                const formattedDate = formatTimestamp(currentEventData.fecha);

                if (eventDetailContainer) { 
                    eventDetailContainer.innerHTML = `
                        <img src="${currentEventData.imagen || 'img/placeholder.jpg'}" alt="${currentEventData.titulo}" class="event-image">
                        <h1>${currentEventData.titulo}</h1>
                        <div class="event-detail-info">
                            <p>🎭 Género: ${currentEventData.genero || 'N/A'}</p>
                            <p>📍 Lugar: ${currentEventData.lugar || 'N/A'}</p>
                            <p>🗓️ Fecha: ${formattedDate}</p>
                            <p class="price">CLP$${currentEventData.precio !== undefined ? currentEventData.precio.toFixed(0) : '0'}</p>
                        </div>
                        <div class="event-detail-description">
                            <h2>Sinopsis</h2>
                            <p>${currentEventData.descripcion || 'No hay descripción disponible para este evento.'}</p>
                        </div>
                        <button class="btn-buy btn-buy-detail" id="buyTicketsBtn">Comprar Entradas</button>
                    `;
                }

                buyTicketsBtn = document.getElementById('buyTicketsBtn');
                if (buyTicketsBtn) {
                    buyTicketsBtn.addEventListener('click', () => {
                        // Guardar datos del evento en sessionStorage (se mantiene igual)
                        sessionStorage.setItem('currentEventForSeats', JSON.stringify({
                            id: currentEventData.id,
                            titulo: currentEventData.titulo,
                            fecha: currentEventData.fecha.toDate().toISOString(),
                            lugar: currentEventData.lugar,
                            precio: currentEventData.precio
                        }));

                        const pagoUrl = `pago.html?id=${encodeURIComponent(currentEventData.id)}`;
                        const user = auth.currentUser;

                        if (user) {
                            // Ya está logueado → ir directo a seleccionar asientos
                            console.log("evento.js: Usuario logueado, redirigiendo a", pagoUrl);
                            window.location.href = pagoUrl;
                        } else {
                            // No está logueado → ir a login con redirect de vuelta a pago
                            const redirectUrl = pagoUrl;
                            const loginUrl = `login.html?redirect=${encodeURIComponent(redirectUrl)}`;
                            console.log("evento.js: Usuario NO logueado, redirigiendo a login:", loginUrl);
                            window.location.href = loginUrl;
                        }
                    });
                }

            } else {
                if (eventDetailContainer) {
                    eventDetailContainer.innerHTML = '<p>Evento no encontrado. Vuelve a la <a href="index.html">página principal</a>.</p>';
                }
            }
        } catch (error) {
            console.error("Error al cargar los detalles del evento desde Firestore:", error);
            if (eventDetailContainer) {
                eventDetailContainer.innerHTML = '<p>Error al cargar los detalles del evento. Por favor, intente de nuevo más tarde o revise su conexión a Firebase.</p>';
            }
        }
    }

    loadEventDetails(); // Inicia la carga de los detalles del evento
});
