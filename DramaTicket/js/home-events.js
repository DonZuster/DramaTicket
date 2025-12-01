// js/home-events.js
import { db } from './firebase-init.js'; // Importa db desde firebase-init.js
import { collection, query, getDocs, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { formatTimestamp } from './utils.js'; // Asegúrate de importar formatTimestamp

document.addEventListener('DOMContentLoaded', async () => {
    const featuredEventList = document.getElementById('featured-event-list');
    const allEventList = document.getElementById('event-list');
    
    // Función para crear un card de evento (reutilizable)
    function createEventCard(event, eventId) {
        const eventCard = document.createElement('div');
        eventCard.className = 'event-card';
        // Usar la ruta de imagen directamente del evento o un placeholder local
        const imageUrl = event.imagen || 'img/placeholder.jpg'; 
        eventCard.innerHTML = `
            <img src="${imageUrl}" alt="${event.titulo}" class="event-card-image">
            <div class="event-card-content">
                <h3>${event.titulo}</h3>
                <p class="event-genre">${event.genero}</p>
                <p class="event-date">${formatTimestamp(event.fecha.toDate())}</p>
                <p class="event-location">${event.lugar}</p>
                <p class="event-price">CLP$${event.precio.toFixed(0)}</p>
                <a href="evento.html?id=${eventId}" class="btn-details">Ver Detalles</a>
            </div>
        `;
        return eventCard;
    }

    // Cargar eventos destacados (ej. los 3 más recientes)
    async function loadFeaturedEvents() {
        if (!db) {
            console.error("Firestore no está inicializado en home-events.js.");
            featuredEventList.innerHTML = '<p>Error al cargar eventos destacados.</p>';
            return;
        }
        try {
            const q = query(collection(db, 'eventos'), orderBy('fecha', 'desc'), limit(3));
            const querySnapshot = await getDocs(q);
            
            if (querySnapshot.empty) {
                featuredEventList.innerHTML = '<p>No hay eventos destacados disponibles en este momento.</p>';
                return;
            }

            featuredEventList.innerHTML = ''; // Limpiar antes de agregar
            querySnapshot.forEach((doc) => {
                const event = doc.data();
                featuredEventList.appendChild(createEventCard(event, doc.id));
            });
        } catch (error) {
            console.error("Error al cargar eventos destacados:", error);
            featuredEventList.innerHTML = '<p>Error al cargar eventos destacados.</p>';
        }
    }

    // Cargar todos los eventos
    async function loadAllEvents() {
        if (!db) {
            console.error("Firestore no está inicializado en home-events.js.");
            allEventList.innerHTML = '<p>Error al cargar eventos.</p>';
            return;
        }
        try {
            const q = query(collection(db, 'eventos'), orderBy('fecha', 'desc')); // Ordenar por fecha
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                allEventList.innerHTML = '<p>No hay eventos disponibles en este momento.</p>';
                return;
            }

            allEventList.innerHTML = ''; // Limpiar antes de agregar
            querySnapshot.forEach((doc) => {
                const event = doc.data();
                allEventList.appendChild(createEventCard(event, doc.id));
            });
        } catch (error) {
            console.error("Error al cargar todos los eventos:", error);
            allEventList.innerHTML = '<p>Error al cargar todos los eventos.</p>';
        }
    }

    // Cargar eventos al inicio
    loadFeaturedEvents();
    loadAllEvents();
});
