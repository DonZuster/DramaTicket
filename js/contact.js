// js/contact.js

import { showToast } from './utils.js'; // Importa la función showToast desde utils.js

document.addEventListener('DOMContentLoaded', () => {
    console.log("contact.js: DOMContentLoaded - Iniciando.");

    const contactForm = document.getElementById('contact-form');
    const contactNameInput = document.getElementById('contact-name');
    const contactEmailInput = document.getElementById('contact-email');
    const contactSubjectInput = document.getElementById('contact-subject');
    const contactMessageInput = document.getElementById('contact-message');
    const contactFormMessageDiv = document.getElementById('contact-form-message'); // Para mensajes dentro del formulario

    if (contactForm) {
        contactForm.addEventListener('submit', handleContactFormSubmit);
    } else {
        console.error("contact.js: Formulario de contacto no encontrado.");
    }

    /**
     * Muestra un mensaje en la interfaz de usuario del formulario.
     * @param {string} message - El texto del mensaje.
     * @param {string} type - El tipo de mensaje ('success', 'error', 'info').
     */
    function showFormMessage(message, type) {
        if (contactFormMessageDiv) {
            contactFormMessageDiv.textContent = message;
            contactFormMessageDiv.classList.remove('success-message', 'error-message', 'info-message'); // Limpiar clases anteriores
            contactFormMessageDiv.classList.add(type + '-message', 'active');
            
            // Ocultar el mensaje después de 5 segundos
            setTimeout(() => {
                contactFormMessageDiv.classList.remove('active');
            }, 5000);
        }
        showToast(message, type); // También usa el toast global
    }

    /**
     * Maneja el envío del formulario de contacto.
     * @param {Event} e - El evento de envío del formulario.
     */
    async function handleContactFormSubmit(e) {
        e.preventDefault(); // Prevenir el envío por defecto del formulario

        const name = contactNameInput.value.trim();
        const email = contactEmailInput.value.trim();
        const subject = contactSubjectInput.value.trim();
        const message = contactMessageInput.value.trim();

        // Validaciones básicas
        if (!name || !email || !subject || !message) {
            showFormMessage("Por favor, rellena todos los campos.", "error");
            return;
        }

        if (!validateEmail(email)) {
            showFormMessage("Por favor, introduce un correo electrónico válido.", "error");
            return;
        }

        // Aquí iría la lógica para enviar el formulario a un servicio de backend
        // o a una Cloud Function de Firebase que maneje el envío de emails.
        // Por ahora, simularemos un envío exitoso.

        try {
            // Deshabilitar el botón y mostrar un indicador de carga
            const submitButton = contactForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.innerHTML = 'Enviando... <i class="fas fa-spinner fa-spin"></i>';
            }

            // Simular un retraso de red
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Simular éxito o error aleatorio (para pruebas)
            const success = Math.random() > 0.1; // 90% de éxito
            
            if (success) {
                showFormMessage("¡Mensaje enviado con éxito! Nos pondremos en contacto contigo pronto.", "success");
                contactForm.reset(); // Limpiar el formulario
            } else {
                throw new Error("Error simulado al enviar el mensaje. Inténtalo de nuevo.");
            }

        } catch (error) {
            console.error("Error al enviar el formulario de contacto:", error);
            showFormMessage("Hubo un error al enviar tu mensaje: " + error.message, "error");
        } finally {
            // Volver a habilitar el botón y restaurar su texto original
            const submitButton = contactForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Enviar Mensaje <i class="fas fa-paper-plane"></i>';
            }
        }
    }

    /**
     * Valida el formato de un correo electrónico.
     * @param {string} email - El correo electrónico a validar.
     * @returns {boolean} True si el formato es válido, false en caso contrario.
     */
    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }
});
