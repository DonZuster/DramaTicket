// js/utils.js

/**
 * Crea un elemento HTML con el tipo, clases y contenido especificados.
 * @param {string} tag - El tipo de etiqueta HTML (ej. 'div', 'p', 'img').
 * @param {string[]} classNames - Un array de nombres de clase CSS para añadir al elemento.
 * @param {object} attributes - Un objeto de atributos a añadir al elemento (ej. { src: 'ruta.jpg', alt: 'Descripción' }).
 * @param {HTMLElement[]|string} children - Elementos hijos o texto/HTML para añadir al elemento.
 * @returns {HTMLElement} El elemento HTML creado.
 */
export function createElement(tag, classNames = [], attributes = {}, children = []) {
    const element = document.createElement(tag);

    if (classNames.length > 0) {
        element.classList.add(...classNames);
    }

    for (const key in attributes) {
        element.setAttribute(key, attributes[key]);
    }

    if (Array.isArray(children)) {
        children.forEach(child => {
            if (typeof child === 'string') {
                // Verificar si la cadena contiene etiquetas HTML para insertarla como innerHTML
                if (/<[a-z][\s\S]*>/i.test(child)) { // Simple regex para detectar HTML
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = child;
                    while (tempDiv.firstChild) {
                        element.appendChild(tempDiv.firstChild);
                    }
                } else {
                    element.appendChild(document.createTextNode(child));
                }
            } else if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });
    } else if (typeof children === 'string') {
        // Para el caso de un solo hijo que es una cadena, también verificar HTML
        if (/<[a-z][\s\S]*>/i.test(children)) {
            element.innerHTML = children; // Si es HTML, usar innerHTML
        } else {
            element.appendChild(document.createTextNode(children));
        }
    }

    return element;
}

/**
 * Formatea un timestamp o una fecha a un string legible.
 * Puede aceptar un objeto Date de JS o un Timestamp de Firebase.
 * @param {firebase.firestore.Timestamp|Date|string|null} timestamp - El timestamp de Firestore o un objeto Date.
 * @returns {string} La fecha y hora formateadas.
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return 'Fecha no disponible';

    let date;
    // Si es un Timestamp de Firestore, convertirlo a Date de JS
    if (timestamp && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else if (typeof timestamp === 'string') {
        // Intentar parsear como ISO string
        date = new Date(timestamp);
        if (isNaN(date.getTime())) { // Si no es una fecha válida, retornar N/A
            return 'Fecha Inválida';
        }
    } else {
        return 'Fecha Inválida';
    }

    const optionsDate = { year: 'numeric', month: 'long', day: 'numeric' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: false };

    const formattedDate = date.toLocaleDateString('es-ES', optionsDate);
    const formattedTime = date.toLocaleTimeString('es-ES', optionsTime);

    return `${formattedDate} ${formattedTime} hs.`;
}


/**
 * Muestra un mensaje flotante (toast) en la parte inferior de la pantalla.
 * @param {string} message - El texto del mensaje.
 * @param {'success'|'error'|'info'} type - El tipo de mensaje para aplicar estilos.
 * @param {number} duration - Duración en milisegundos (por defecto 3000ms).
 */
export function showToast(message, type = 'info', duration = 3000) {
    let messageBox = document.querySelector('.message-box');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.classList.add('message-box');
        document.body.appendChild(messageBox);
    }

    messageBox.textContent = message;
    messageBox.classList.remove('success', 'error', 'info'); // Limpiar clases anteriores
    messageBox.classList.add(type, 'active');

    setTimeout(() => {
        messageBox.classList.remove('active');
    }, duration);
}


/**
 * Muestra un modal de mensaje genérico con opciones de confirmación.
 * @param {string} title - Título del modal.
 * @param {string} message - Mensaje a mostrar.
 * @param {boolean} showConfirmButton - Si se debe mostrar el botón de confirmar.
 * @param {string} confirmText - Texto del botón de confirmar.
 * @param {string} cancelText - Texto del botón de cancelar.
 * @returns {Promise<boolean>} Resuelve a true si se confirma, false si se cancela.
 */
export function showGenericMessageModal(title, message, showConfirmButton = false, confirmText = 'Aceptar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        let modalOverlay = document.getElementById('generic-modal-overlay');
        if (!modalOverlay) {
            modalOverlay = document.createElement('div');
            modalOverlay.id = 'generic-modal-overlay';
            modalOverlay.classList.add('modal-overlay');
            modalOverlay.innerHTML = `
                <div class="modal-content">
                    <h3 id="generic-modal-title"></h3>
                    <p id="generic-modal-message"></p>
                    <div class="modal-actions">
                        <button id="generic-modal-confirm-btn" class="btn btn-primary" style="display: none;"></button>
                        <button id="generic-modal-cancel-btn" class="btn btn-cancel"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(modalOverlay);
        }

        const modalTitle = document.getElementById('generic-modal-title');
        const modalMessage = document.getElementById('generic-modal-message');
        const confirmBtn = document.getElementById('generic-modal-confirm-btn');
        const cancelBtn = document.getElementById('generic-modal-cancel-btn');

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        if (showConfirmButton) {
            confirmBtn.textContent = confirmText;
            confirmBtn.style.display = 'inline-block';
            cancelBtn.textContent = cancelText;
        } else {
            confirmBtn.style.display = 'none';
            cancelBtn.textContent = confirmText; // Si no hay confirm, el "cancelar" es el "aceptar"
        }

        const closeAndResolve = (result) => {
            modalOverlay.classList.remove('flex');
            confirmBtn.removeEventListener('click', onConfirmClick);
            cancelBtn.removeEventListener('click', onCancelClick);
            resolve(result);
        };

        const onConfirmClick = () => closeAndResolve(true);
        const onCancelClick = () => closeAndResolve(false);

        confirmBtn.addEventListener('click', onConfirmClick);
        cancelBtn.addEventListener('click', onCancelClick);

        modalOverlay.classList.add('flex');
    });
}


/**
 * Guarda datos en localStorage.
 * @param {string} key - La clave bajo la cual se guardarán los datos.
 * @param {any} data - Los datos a guardar. Se convertirán a JSON.
 */
export function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error("Error al guardar en localStorage:", e);
    }
}

/**
 * Obtiene datos de localStorage.
 * @param {string} key - La clave de los datos a obtener.
 * @returns {any|null} Los datos parseados o null si no se encuentran o hay un error.
 */
export function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error("Error al obtener de localStorage:", e);
        return null;
    }
}

/**
 * Elimina datos de localStorage.
 * @param {string} key - La clave de los datos a eliminar.
 */
export function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error("Error al eliminar de localStorage:", e);
    }
}
