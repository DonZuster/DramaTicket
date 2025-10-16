// js/search.js
import { db } from './firebase-init.js'; // Importa db desde firebase-init.js
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { formatTimestamp } from './utils.js'; // Asegúrate de importar formatTimestamp

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const eventListContainer = document.getElementById('event-list'); // El contenedor donde se muestran los eventos

    if (!searchInput || !searchButton || !eventListContainer) {
        console.warn("Elementos de búsqueda o lista de eventos no encontrados. La funcionalidad de búsqueda podría no funcionar.");
        return;
    }

    // Función para crear un card de evento (reutilizable, copiada de home-events.js o debería ser una utilidad común)
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


    async function performSearch() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        eventListContainer.innerHTML = ''; // Limpiar resultados anteriores

        if (!searchTerm) {
            // Si el término de búsqueda está vacío, recargar todos los eventos
            // Esto asume que tienes una función para cargar todos los eventos en home-events.js
            // o que la lista se llenará por defecto. Si no, debería recargarse aquí.
            console.log("Término de búsqueda vacío, mostrando todos los eventos (si loadAllEvents estuviera disponible).");
            // Puedes llamar a loadAllEvents() si home-events.js lo exporta y aquí lo importas.
            // Para simplificar, si no hay término, no se muestra nada o se muestra un mensaje.
            eventListContainer.innerHTML = '<p>Introduce un término de búsqueda para encontrar eventos.</p>';
            return;
        }

        if (!db) {
            console.error("Firestore no está inicializado en search.js.");
            eventListContainer.innerHTML = '<p>Error: Firestore no disponible para la búsqueda.</p>';
            return;
        }

        try {
            const eventsRef = collection(db, 'eventos');
            let q;

            // Simple búsqueda de texto completo para los campos relevantes
            // Ten en cuenta que Firestore no soporta búsquedas de texto completo complejas
            // sin una solución de terceros (ej. Algolia, o un backend con ElasticSearch).
            // Esto hará una búsqueda por prefijo exacto.
            q = query(eventsRef); // Empezamos con una consulta general y filtramos en el cliente

            // Filtramos en el cliente para simular una búsqueda más flexible
            // Para una búsqueda en tiempo real más robusta, necesitarías otro enfoque (ej. Cloud Functions + Algolia)
            const querySnapshot = await getDocs(q);
            let resultsFound = false;

            querySnapshot.forEach((doc) => {
                const event = doc.data();
                const eventId = doc.id;
                // Convertir a minúsculas para la comparación de búsqueda
                const title = (event.titulo || '').toLowerCase();
                const genre = (event.genero || '').toLowerCase();
                const location = (event.lugar || '').toLowerCase();

                if (title.includes(searchTerm) || genre.includes(searchTerm) || location.includes(searchTerm)) {
                    eventListContainer.appendChild(createEventCard(event, eventId));
                    resultsFound = true;
                }
            });

            if (!resultsFound) {
                eventListContainer.innerHTML = '<p>No se encontraron eventos que coincidan con tu búsqueda.</p>';
            }
        } catch (error) {
            console.error("Error al realizar la búsqueda:", error);
            eventListContainer.innerHTML = '<p>Error al realizar la búsqueda de eventos.</p>';
        }
    }

    searchButton.addEventListener('click', performSearch);

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    console.log("search.js: Búsqueda inicializada.");
});
