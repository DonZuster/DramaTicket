// js/confirmacion.js
import { formatTimestamp } from './utils.js';

// Elementos del DOM para la confirmación
const confEventTitleSpan = document.getElementById('conf-event-title');
const confEventDateSpan = document.getElementById('conf-event-date');
const confEventLocationSpan = document.getElementById('conf-event-location');
const confSelectedSeatsSpan = document.getElementById('conf-selected-seats');
const confQuantitySpan = document.getElementById('conf-quantity');
const confTotalAmountSpan = document.getElementById('conf-total-amount');
const confPurchaseIdSpan = document.getElementById('conf-purchase-id');
const qrCodeCanvas = document.getElementById('qr-code-canvas');

document.addEventListener('DOMContentLoaded', () => {
    const confirmationDataString = sessionStorage.getItem('lastPurchaseConfirmation');

    if (confirmationDataString) {
        try {
            const confirmationData = JSON.parse(confirmationDataString);
            console.log("Datos de confirmación cargados:", confirmationData);

            // Rellenar los detalles de la compra
            if (confEventTitleSpan) confEventTitleSpan.textContent = confirmationData.eventTitle || 'N/A';
            
            // Usar formatTimestamp para la fecha, ya que puede venir como Date de JS o Firestore Timestamp
            // Si confirmationData.eventDate es una cadena ISO, new Date() la convertirá en un objeto Date.
            if (confEventDateSpan && confirmationData.eventDate) {
                confEventDateSpan.textContent = formatTimestamp(new Date(confirmationData.eventDate));
            } else {
                confEventDateSpan.textContent = 'N/A';
            }

            if (confEventLocationSpan) confEventLocationSpan.textContent = confirmationData.eventLocation || 'N/A';
            if (confSelectedSeatsSpan) confSelectedSeatsSpan.textContent = (confirmationData.selectedSeats || []).join(', ') || 'N/A';
            if (confQuantitySpan) confQuantitySpan.textContent = confirmationData.quantity || 0;
            // Asegurarse de que el total se muestre con el formato CLP$ y sin decimales
            if (confTotalAmountSpan) confTotalAmountSpan.textContent = `CLP$${(confirmationData.totalAmount || 0).toFixed(0)}`;
            if (confPurchaseIdSpan) confPurchaseIdSpan.textContent = confirmationData.purchaseId || 'N/A';

            // Generar Código QR
            if (qrCodeCanvas && confirmationData.qrContent) {
                new QRious({
                    element: qrCodeCanvas,
                    value: confirmationData.qrContent,
                    size: 200, // Tamaño del QR en píxeles
                    level: 'H' // Nivel de corrección de errores (L, M, Q, H)
                });
            } else {
                console.warn("No se pudo generar el código QR. Elemento canvas o contenido QR no disponibles.");
            }

            // Opcional: Limpiar el sessionStorage después de mostrar la confirmación
            // sessionStorage.removeItem('lastPurchaseConfirmation');
            // console.log("Datos de confirmación eliminados de sessionStorage (opcional).");

        } catch (error) {
            console.error("Error al parsear los datos de confirmación:", error);
            displayErrorMessage("Error al cargar los detalles de la confirmación. Por favor, intente de nuevo.");
        }
    } else {
        console.warn("No se encontraron datos de confirmación en sessionStorage.");
        displayErrorMessage("No se encontraron detalles de la compra. Vuelve a la página de pago para completar tu compra.");
        // Opcional: Redirigir al usuario si no hay datos de confirmación
        // setTimeout(() => { window.location.href = 'pago.html'; }, 3000);
    }
});

function displayErrorMessage(message) {
    const mainContainer = document.querySelector('main.container');
    if (mainContainer) {
        mainContainer.innerHTML = `
            <h1 class="error-title">¡Error!</h1>
            <p class="error-text">${message}</p>
            <a href="index.html" class="btn-back-home">Volver al Inicio</a>
        `;
    }
}