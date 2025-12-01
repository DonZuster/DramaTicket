// js/index.js
import { auth, db } from './firebase-init.js'; // Importa auth y db
import { collection, getDocs, query, where, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createElement, formatTimestamp } from './utils.js';

const eventListContainer = document.getElementById('event-list-container');
const searchInput = document.getElementById('search-input');
const searchForm = document.getElementById('search-form');
const noEventsMessage = document.getElementById('no-events-message');

let allEvents = []; // Almacenará todos los eventos cargados desde Firestore

// Elementos del carrusel
const carouselSlide = document.getElementById('carousel-slide');
const carouselPrevBtn = document.getElementById('carousel-prev');
const carouselNextBtn = document.getElementById('carousel-next');
const carouselDotsContainer = document.getElementById('carousel-dots');

// Imágenes del carrusel: Usa rutas relativas a tu carpeta 'img'
// Asegúrate de que las rutas sean correctas según la ubicación de tu 'index.html'
// Por ejemplo, si 'index.html' y la carpeta 'img' están al mismo nivel, usa 'img/nombre_de_la_imagen.jpg'
const carouselImages = [
    'img/teatro.png', // Cambia esta ruta por la de tu primera imagen
    'img/escenario.png', // Cambia esta ruta por la de tu segunda imagen
    'img/acto.png'  // Puedes añadir más imágenes aquí con sus rutas
];
let currentSlideIndex = 0;
let carouselInterval;

document.addEventListener('DOMContentLoaded', () => {
    console.log("index.js: DOMContentLoaded - Iniciando.");

    // Esperar a que Firebase Auth y Firestore estén inicializados globalmente
    const checkFirebaseReady = setInterval(() => {
        if (typeof auth !== 'undefined' && typeof db !== 'undefined') {
            clearInterval(checkFirebaseReady); // Detener el chequeo
            console.log("index.js: Firebase Auth y Firestore disponibles.");

            // Inicializar el carrusel
            initCarousel();

            // Escuchar eventos en tiempo real
            listenToEvents();

            // Configurar el formulario de búsqueda
            if (searchForm) {
                searchForm.addEventListener('submit', handleSearch);
            }

        } else {
            console.warn("index.js: Firebase Auth o Firestore no están disponibles aún.");
        }
    }, 100); // Chequear cada 100ms
});

/**
 * Inicializa el carrusel, carga las imágenes y configura la auto-reproducción.
 */
function initCarousel() {
    // Limpiar slides y dots existentes
    carouselSlide.innerHTML = '';
    carouselDotsContainer.innerHTML = '';

    // Añadir imágenes al carrusel
    carouselImages.forEach((src, index) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = `Imagen de Teatro ${index + 1}`;
        // Manejo de error de carga de imagen para imágenes locales
        img.onerror = function() {
            console.error(`Error al cargar la imagen: ${this.src}. Asegúrate de que la ruta sea correcta.`);
            // Puedes poner una imagen de fallback si lo deseas
            this.onerror=null;
            this.src='https://placehold.co/1200x500/FF0000/FFFFFF?text=Error+Carga+Imagen';
        };
        carouselSlide.appendChild(img);

        // Crear los puntos de navegación
        const dot = document.createElement('span');
        dot.classList.add('carousel-dot');
        dot.dataset.index = index;
        dot.addEventListener('click', () => goToSlide(index));
        carouselDotsContainer.appendChild(dot);
    });

    // Configurar botones de navegación
    if (carouselPrevBtn) {
        carouselPrevBtn.addEventListener('click', showPrevSlide);
    }
    if (carouselNextBtn) {
        carouselNextBtn.addEventListener('click', showNextSlide);
    }

    // Mostrar el primer slide y empezar la auto-reproducción
    updateCarousel();
    startCarouselAutoPlay();

    // Pausar auto-reproducción al pasar el ratón por encima del carrusel
    const heroSection = document.querySelector('.hero-section');
    if (heroSection) {
        heroSection.addEventListener('mouseenter', pauseCarouselAutoPlay);
        heroSection.addEventListener('mouseleave', startCarouselAutoPlay);
    }
}

/**
 * Actualiza la visualización del carrusel para mostrar el slide actual.
 */
function updateCarousel() {
    const offset = -currentSlideIndex * 100;
    carouselSlide.style.transform = `translateX(${offset}%)`;

    // Actualizar los puntos de navegación
    document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
        if (index === currentSlideIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

/**
 * Muestra el slide anterior.
 */
function showPrevSlide() {
    currentSlideIndex = (currentSlideIndex === 0) ? carouselImages.length - 1 : currentSlideIndex - 1;
    updateCarousel();
    startCarouselAutoPlay(); // Reiniciar el temporizador
}

/**
 * Muestra el siguiente slide.
 */
function showNextSlide() {
    currentSlideIndex = (currentSlideIndex === carouselImages.length - 1) ? 0 : currentSlideIndex + 1;
    updateCarousel();
    startCarouselAutoPlay(); // Reiniciar el temporizador
}

/**
 * Va directamente a un slide específico.
 * @param {number} index - El índice del slide al que ir.
 */
function goToSlide(index) {
    currentSlideIndex = index;
    updateCarousel();
    startCarouselAutoPlay(); // Reiniciar el temporizador
}

/**
 * Inicia la auto-reproducción del carrusel.
 */
function startCarouselAutoPlay() {
    clearInterval(carouselInterval); // Limpiar cualquier intervalo existente
    carouselInterval = setInterval(showNextSlide, 5000); // Cambiar de slide cada 5 segundos
}

/**
 * Pausa la auto-reproducción del carrusel.
 */
function pauseCarouselAutoPlay() {
    clearInterval(carouselInterval);
}


/**
 * Escucha los eventos en tiempo real desde Firestore y los renderiza.
 */
function listenToEvents() {
    if (!db) {
        console.error("Firestore no está inicializado. No se pueden escuchar los eventos.");
        return;
    }

    const eventsColRef = collection(db, 'eventos');
    // Escuchar cambios en la colección 'eventos'
    onSnapshot(eventsColRef, (snapshot) => {
        const events = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            events.push({
                id: doc.id,
                ...data,
                // Convertir Timestamps de Firestore a objetos Date de JS
                fecha: data.fecha ? (data.fecha.toDate ? data.fecha.toDate() : new Date(data.fecha)) : null
            });
        });
        allEvents = events; // Almacenar todos los eventos
        console.log("index.js: Eventos cargados/actualizados (tiempo real):", allEvents);
        renderEvents(allEvents); // Renderizar todos los eventos al inicio o al actualizar
    }, (error) => {
        console.error("index.js: Error al escuchar eventos:", error);
        if (eventListContainer) {
            eventListContainer.innerHTML = '<p class="error-message active">Error al cargar los eventos. Por favor, intente de nuevo más tarde.</p>';
        }
    });
}

/**
 * Renderiza la lista de eventos en el contenedor.
 * @param {Array<Object>} eventsToRender - Array de objetos de evento a renderizar.
 */
function renderEvents(eventsToRender) {
    if (!eventListContainer) {
        console.error("Contenedor de lista de eventos no encontrado.");
        return;
    }

    eventListContainer.innerHTML = ''; // Limpiar eventos existentes

    if (eventsToRender.length === 0) {
        noEventsMessage.style.display = 'block';
        return;
    } else {
        noEventsMessage.style.display = 'none';
    }

    eventsToRender.forEach(eventData => {
        const eventCard = createElement('div', ['event-card'], {}, [
            createElement('img', [], { src: eventData.imagen || 'https://placehold.co/400x220/888888/FFFFFF?text=Sin+Imagen', alt: eventData.titulo || 'Evento' }),
            createElement('div', ['event-card-content'], {}, [
                createElement('h3', [], {}, eventData.titulo || 'Evento Desconocido'),
                // Reemplazando <strong> con iconos
                createElement('p', [], {}, ` <i class="fas fa-tag icon-margin"></i> ${eventData.genero || 'N/A'}`), // Género con icono de etiqueta
                createElement('p', [], {}, ` <i class="fas fa-map-marker-alt icon-margin"></i> ${eventData.lugar || 'N/A'}`), // Lugar con icono de marcador de mapa
                createElement('p', [], {}, ` <i class="fas fa-calendar-alt icon-margin"></i> ${eventData.fecha ? formatTimestamp(eventData.fecha) : 'N/A'}`), // Fecha con icono de calendario
                createElement('p', ['event-price'], {}, `CLP$${eventData.precio ? eventData.precio.toFixed(0) : '0'}`),
                createElement('a', ['btn-details'], { href: `evento.html?id=${eventData.id}` }, 'Ver Detalles')
            ])
        ]);
        eventListContainer.appendChild(eventCard);
    });
}

/**
 * Maneja el envío del formulario de búsqueda y filtra los eventos.
 * @param {Event} e - El evento de envío del formulario.
 */
function handleSearch(e) {
    e.preventDefault(); // Evitar que el formulario se recargue

    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        renderEvents(allEvents); // Si el campo de búsqueda está vacío, muestra todos los eventos
        return;
    }

    const filteredEvents = allEvents.filter(event => {
        const titleMatch = (event.titulo || '').toLowerCase().includes(searchTerm);
        const genreMatch = (event.genero || '').toLowerCase().includes(searchTerm);
        const locationMatch = (event.lugar || '').toLowerCase().includes(searchTerm);
        return titleMatch || genreMatch || locationMatch;
    });

    renderEvents(filteredEvents); // Renderizar solo los eventos filtrados
}
