// js/payment-details.js
import { formatTimestamp } from './utils.js'; // formatTimestamp es de utils.js
import { db, auth } from './firebase-init.js'; // Importa db y auth desde firebase-init.js
import { addDoc, collection, serverTimestamp, doc, setDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'; // Añadir writeBatch

// Elementos del DOM para el resumen de compra
const paymentEventTitleSpan = document.getElementById('payment-event-title');
const paymentEventDateSpan = document.getElementById('payment-event-date');
const paymentEventLocationSpan = document.getElementById('payment-event-location');
const paymentSelectedSeatsSpan = document.getElementById('payment-selected-seats');
const paymentQuantitySpan = document.getElementById('payment-quantity');
const paymentTotalAmountSpan = document.getElementById('payment-total-amount');

// Elementos del DOM del formulario de pago
const cardPaymentForm = document.getElementById('card-payment-form');
const cardNumberInput = document.getElementById('card-number');
const cardNameInput = document.getElementById('card-name');
const expiryDateInput = document.getElementById('expiry-date');
const cvcInput = document.getElementById('cvc');
const payNowBtn = document.getElementById('pay-now-btn');
const backToSeatsBtn = document.getElementById('back-to-seats-btn');
const paymentDetailsMessage = document.getElementById('payment-details-message'); // Elemento para mensajes

let purchaseData = null; // Almacenará los datos de la compra del sessionStorage
let currentUser = null; // Para almacenar el usuario autenticado

// Función global para el callback de reCAPTCHA Enterprise, definida en el HTML
// window.onRecaptchaLoadCallback = function() { ... }
// window.onRecaptchaSuccess = function(token) { ... }

document.addEventListener('DOMContentLoaded', () => {
    console.log("payment-details.js: DOMContentLoaded - Iniciando.");

    // Escuchar el estado de autenticación
    auth.onAuthStateChanged((user) => { // Usar onAuthStateChanged directamente en auth
        currentUser = user;
        loadPurchaseDetails(); // Cargar resumen después de que el usuario esté disponible

        if (payNowBtn) {
            // El botón de pago se deshabilita si no hay usuario o es anónimo
            payNowBtn.disabled = !user || user.isAnonymous;
            if (!user || user.isAnonymous) {
                showMessage('Debes iniciar sesión para completar la compra.', 'error');
            } else {
                // Si hay usuario autenticado, limpiar mensajes previos y el botón se habilitará
                // una vez que los datos de compra se carguen y sean válidos (en loadPurchaseDetails).
                if (paymentDetailsMessage) {
                    paymentDetailsMessage.textContent = '';
                    paymentDetailsMessage.classList.remove('active', 'error-message', 'info-message', 'success-message');
                }
            }
        }
    });

    if (cardPaymentForm) {
        cardPaymentForm.addEventListener('submit', handlePaymentSubmit);
    }
    if (backToSeatsBtn) {
        backToSeatsBtn.addEventListener('click', () => {
            // Redirigir de vuelta a la página de selección de asientos, manteniendo el ID del evento si es posible
            const eventId = purchaseData ? purchaseData.eventId : '';
            window.location.href = `pago.html${eventId ? `?id=${eventId}` : ''}`;
        });
    }

    // Input masks/formatting
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', formatCardNumber);
    }
    if (expiryDateInput) {
        expiryDateInput.addEventListener('input', formatExpiryDate);
        expiryDateInput.setAttribute('maxlength', '5'); // MM/YY
    }
    if (cvcInput) {
        cvcInput.setAttribute('maxlength', '4'); // Max 4 digits for CVC
    }

    // Inicializar reCAPTCHA Enterprise si la función global está definida
    if (typeof window.grecaptcha_ready_callback === 'function') {
        window.grecaptcha_ready_callback();
    }
});

/**
 * Carga los detalles de la compra desde sessionStorage y los muestra.
 */
function loadPurchaseDetails() {
    const storedPurchaseData = sessionStorage.getItem('currentPurchase');

    if (storedPurchaseData) {
        try {
            purchaseData = JSON.parse(storedPurchaseData);
            console.log("payment-details.js: Datos de compra cargados de sessionStorage:", purchaseData);

            if (paymentEventTitleSpan) paymentEventTitleSpan.textContent = purchaseData.eventTitle || 'N/A';
            if (paymentEventDateSpan) {
                const eventDateObj = new Date(purchaseData.eventDate);
                paymentEventDateSpan.textContent = formatTimestamp(eventDateObj) || 'N/A';
            }
            if (paymentEventLocationSpan) paymentEventLocationSpan.textContent = purchaseData.eventLocation || 'N/A';

            // Modificado para mostrar asientos sin el prefijo "seat-"
            if (paymentSelectedSeatsSpan) {
                paymentSelectedSeatsSpan.textContent = (purchaseData.selectedSeats || []).join(', ') || 'N/A';
            }

            if (paymentQuantitySpan) paymentQuantitySpan.textContent = purchaseData.quantity || '0';
            if (paymentTotalAmountSpan) paymentTotalAmountSpan.textContent = `CLP$${purchaseData.totalAmount ? purchaseData.totalAmount.toFixed(0) : '0'}`;

            // Habilitar el botón de pago si hay un usuario logueado y datos de compra
            if (payNowBtn && currentUser && !currentUser.isAnonymous && purchaseData.quantity > 0) {
                payNowBtn.disabled = false;
                // Limpiar cualquier mensaje previo de error/info si el botón se habilita
                if (paymentDetailsMessage) {
                    paymentDetailsMessage.textContent = '';
                    paymentDetailsMessage.classList.remove('active', 'error-message', 'info-message');
                }
            }

        } catch (error) {
            console.error("payment-details.js: Error al parsear los datos de compra de sessionStorage:", error);
            showMessage("Error al cargar los detalles de la compra. Por favor, intente de nuevo.", "error");
            // Opcional: redirigir si no se pueden cargar los datos cruciales
            // setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        }
    } else {
        console.warn("payment-details.js: No se encontraron datos de compra en sessionStorage.");
        showMessage("No se encontraron detalles de la compra. Vuelve a la página de selección de asientos para completar tu compra.", "info");
        // Redirigir al usuario si no hay datos
        // setTimeout(() => { window.location.href = `pago.html?id=${new URLSearchParams(window.location.search).get('id')}`; }, 3000);
    }
}

/**
 * Muestra un mensaje en la interfaz de usuario.
 * @param {string} message - El texto del mensaje.
 * @param {string} type - El tipo de mensaje ('success', 'error', 'info').
 */
function showMessage(message, type) {
    if (paymentDetailsMessage) {
        paymentDetailsMessage.textContent = message;
        // Reinicia todas las clases de tipo de mensaje antes de añadir la nueva
        paymentDetailsMessage.classList.remove('error-message', 'info-message', 'success-message');
        paymentDetailsMessage.classList.add(type + '-message', 'active');
        setTimeout(() => {
            paymentDetailsMessage.classList.remove('active');
        }, 5000);
    }
    // Asumiendo que showToast es una función global disponible desde utils.js
    if (typeof showToast === 'function') {
        showToast(message, type);
    }
}

/**
 * Maneja el envío del formulario de pago.
 * Guarda la compra en Firestore y redirige a confirmacion.html.
 * @param {Event} e - El evento de envío del formulario.
 */
async function handlePaymentSubmit(e) {
    e.preventDefault();

    if (!purchaseData) {
        showMessage("No hay datos de compra para procesar. Vuelve a la selección de asientos.", "error");
        return;
    }
    if (!currentUser || currentUser.isAnonymous) {
        showMessage("Debes iniciar sesión para completar la compra.", "error");
        // Puedes agregar una redirección aquí si lo deseas
        // setTimeout(() => { window.location.href = 'login.html'; }, 2000);
        return;
    }

    if (payNowBtn) {
        payNowBtn.disabled = true;
        payNowBtn.innerHTML = 'Procesando... <i class="fas fa-spinner fa-spin"></i>';
    }

    const cardNumber = cardNumberInput ? cardNumberInput.value.trim().replace(/\s/g, '') : '';
    const cardName = cardNameInput ? cardNameInput.value.trim() : '';
    const expiryDate = expiryDateInput ? expiryDateInput.value.trim() : '';
    const cvc = cvcInput ? cvcInput.value.trim() : '';

    // Validaciones
    // Permite 13 a 19 dígitos, asumiendo que el formato y el maxlength se manejan en el input
    if (!cardNumber || !/^\d{13,19}$/.test(cardNumber)) {
        showMessage("Número de tarjeta inválido (debe tener entre 13 y 19 dígitos numéricos).", "error");
        if (payNowBtn) {
            payNowBtn.disabled = false;
            payNowBtn.innerHTML = 'Pagar Ahora <i class="fas fa-credit-card"></i>';
        }
        return;
    }

    if (!cardName || cardName.length < 2) {
        showMessage("Por favor, ingresa el nombre del titular de la tarjeta.", "error");
        if (payNowBtn) {
            payNowBtn.disabled = false;
            payNowBtn.innerHTML = 'Pagar Ahora <i class="fas fa-credit-card"></i>';
        }
        return;
    }

    // Validar fecha de expiración (MM/AA y que no esté expirada)
    if (!expiryDate || !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate)) {
        showMessage("Fecha de expiración inválida (formato MM/AA).", "error");
        if (payNowBtn) {
            payNowBtn.disabled = false;
            payNowBtn.innerHTML = 'Pagar Ahora <i class="fas fa-credit-card"></i>';
        }
        return;
    }
    const [expMonth, expYearShort] = expiryDate.split('/').map(Number);
    const expYear = 2000 + expYearShort; // Asume años 20xx
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // getMonth() es 0-index

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
        showMessage("La tarjeta ha expirado. Por favor, usa una tarjeta válida.", "error");
        if (payNowBtn) {
            payNowBtn.disabled = false;
            payNowBtn.innerHTML = 'Pagar Ahora <i class="fas fa-credit-card"></i>';
        }
        return;
    }

    if (!cvc || !/^\d{3,4}$/.test(cvc)) { // Permite 3 o 4 dígitos
        showMessage("CVC inválido (3 o 4 dígitos numéricos).", "error");
        if (payNowBtn) {
            payNowBtn.disabled = false;
            payNowBtn.innerHTML = 'Pagar Ahora <i class="fas fa-credit-card"></i>';
        }
        return;
    }

    // Aquí iría la lógica real de procesamiento de pago con un proveedor (ej. Stripe, PayPal)
    // Para esta demostración, simulamos un éxito.
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simular retraso de procesamiento

    try {
        // 1. Guardar la compra en Firestore
        const purchasesCollectionRef = collection(db, 'purchases');
        const purchaseToSave = {
            userId: currentUser.uid,
            userEmail: currentUser.email || null,   // 👈 NUEVO
            eventId: purchaseData.eventId,
            eventTitle: purchaseData.eventTitle,
            eventDate: purchaseData.eventDate,
            eventLocation: purchaseData.eventLocation,
            ticketPrice: purchaseData.ticketPrice,
            selectedSeats: purchaseData.selectedSeats.map(seatId => `seat-${seatId}`),
            quantity: purchaseData.quantity,
            totalAmount: purchaseData.totalAmount,
            purchaseDate: serverTimestamp(),
            paymentMethod: 'Tarjeta de Crédito',
            paymentDetails: {
                last4: cardNumber.slice(-4),
                cardName: cardName,
                expiry: expiryDate
            },
            status: 'completed'
        };



        const docRef = await addDoc(purchasesCollectionRef, purchaseToSave);
        const purchaseId = docRef.id;
        console.log("handlePaymentSubmit: Compra guardada en Firestore con ID:", purchaseId);

        const eventSeatsCollectionRef = collection(db, 'eventos', purchaseData.eventId, 'seats');
        const batch = writeBatch(db);

        for (const seatId of purchaseData.selectedSeats) {
            const seatDocRef = doc(eventSeatsCollectionRef, `seat-${seatId}`);
            batch.set(seatDocRef, {
                status: 'occupied',
                userId: currentUser.uid,
                purchaseId: purchaseId,
                timestamp: serverTimestamp()
            }, { merge: true });
        }

        await batch.commit();


        console.log("handlePaymentSubmit: Asientos marcados como ocupados en Firestore.");

        // 3. Preparar los datos de confirmación para la página siguiente
        const qrContent = JSON.stringify({
            purchaseId: purchaseId,
            userId: currentUser.uid,
            eventId: purchaseData.eventId,
            seats: purchaseData.selectedSeats // Enviar sin prefijo para QR si no es necesario
        });

        sessionStorage.setItem('lastPurchaseConfirmation', JSON.stringify({
            ...purchaseToSave, // Incluye todos los datos de la compra original
            purchaseId: purchaseId,
            qrContent: qrContent // Contenido para el QR
        }));
        console.log("handlePaymentSubmit: Datos de confirmación (incluido QR) guardados en sessionStorage.");

        // Limpiar sessionStorage de los datos de compra en curso
        sessionStorage.removeItem('currentPurchase');
        console.log("handlePaymentSubmit: Datos de compra eliminados de sessionStorage.");

        showMessage("¡Compra realizada con éxito! Redirigiendo a la confirmación...", "success");

        setTimeout(() => {
            window.location.href = 'confirmacion.html';
        }, 2000);

    } catch (error) {
        console.error("handlePaymentSubmit: Error al procesar el pago o guardar la compra:", error);
        // Verificar si el error es de permisos de Firebase
        if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
            showMessage("Hubo un error de permisos. Asegúrate de que tu cuenta está iniciada y tienes los permisos necesarios para realizar compras. Si eres un usuario nuevo, por favor, registra tu cuenta primero.", "error", 7000);
        } else {
            showMessage("Hubo un error al procesar tu compra. Por favor, intenta de nuevo. " + error.message, "error");
        }
    } finally {
        if (payNowBtn) {
            payNowBtn.disabled = false;
            payNowBtn.innerHTML = 'Pagar Ahora <i class="fas fa-credit-card"></i>';
        }
        // Resetear reCAPTCHA después del intento de pago
        if (typeof grecaptcha !== 'undefined' && grecaptcha.enterprise && typeof window.recaptchaWidgetId !== 'undefined') {
            grecaptcha.enterprise.reset(window.recaptchaWidgetId);
        }
    }
}

// Funciones para formatear inputs
function formatCardNumber(event) {
    let value = event.target.value.replace(/\D/g, ''); // Eliminar NO dígitos
    // Insertar espacios cada 4 dígitos
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    // Limitar a 19 caracteres (16 dígitos + 3 espacios)
    event.target.value = value.slice(0, 19);
}

function formatExpiryDate(event) {
    let value = event.target.value.replace(/\D/g, ''); // Solo dígitos
    if (value.length > 2) {
        value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    event.target.value = value;
}
