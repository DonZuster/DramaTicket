// js/register.js
// Importa las funciones necesarias de Firebase Auth y Firestore desde firebase-init.js
import { auth, db } from './firebase-init.js';
import { createUserWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast, showGenericMessageModal } from './utils.js'; // Importa las funciones de utilidad

// Elementos del DOM del formulario de registro
const registerForm = document.getElementById('register-form');
const registerNameInput = document.getElementById('register-name');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');
const registerConfirmPasswordInput = document.getElementById('register-confirm-password');
const registerErrorMessage = document.getElementById('register-error-message');

// Asegúrate de que el DOM esté completamente cargado antes de añadir listeners
document.addEventListener('DOMContentLoaded', () => {
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    } else {
        console.error("register.js: Formulario de registro no encontrado.");
    }
});

/**
 * Maneja el envío del formulario de registro.
 * @param {Event} e - El evento de envío del formulario.
 */
async function handleRegister(e) {
    e.preventDefault(); // Evitar la recarga de la página

    const name = registerNameInput.value.trim();
    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value.trim();
    const confirmPassword = registerConfirmPasswordInput.value.trim();

    if (!name || !email || !password || !confirmPassword) {
        showErrorMessage("Por favor, completa todos los campos.");
        return;
    }

    if (password.length < 6) {
        showErrorMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    if (password !== confirmPassword) {
        showErrorMessage("Las contraseñas no coinciden.");
        return;
    }

    // Ocultar mensaje de error previo
    hideErrorMessage();
    showToast("Registrando usuario...", "info");

    try {
        // Asegúrate de que 'auth' esté disponible globalmente a través de window.auth
        if (!window.auth) {
            showErrorMessage("Error: Firebase Auth no está inicializado. Recargue la página.");
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;

        // Actualizar el perfil del usuario con el nombre
        await updateProfile(user, { displayName: name });

        // Guardar información adicional del usuario en Firestore
        // Asegúrate de que 'db' esté disponible globalmente a través de window.db
        if (window.db) {
            const userDocRef = doc(window.db, 'users', user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                name: name,
                registeredAt: new Date(),
                isAnonymous: false // Asegurar que no es anónimo
            }, { merge: true }); // Usar merge: true para no sobrescribir si ya existe (ej. si se autenticó anónimamente antes)
            console.log("Documento de usuario creado/actualizado en Firestore:", user.uid);
        } else {
            console.warn("Firestore (db) no está inicializado. No se puede guardar información adicional del usuario.");
        }

        showToast("¡Registro exitoso! Redirigiendo...", "success");
        setTimeout(() => {
            window.location.href = 'my-account.html'; // Redirigir a la página de mi cuenta o a index.html
        }, 1500);

    } catch (error) {
        console.error("Error al registrar usuario:", error);
        let errorMessage = "Error al registrar: ";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "El correo electrónico ya está en uso.";
                break;
            case 'auth/invalid-email':
                errorMessage = "El formato del correo electrónico no es válido.";
                break;
            case 'auth/operation-not-allowed':
                errorMessage = "El registro con correo y contraseña está deshabilitado. Contacta al soporte.";
                break;
            case 'auth/weak-password':
                errorMessage = "La contraseña es demasiado débil (mínimo 6 caracteres).";
                break;
            default:
                errorMessage += error.message;
                break;
        }
        showErrorMessage(errorMessage);
        showToast(errorMessage, "error");
    }
}

/**
 * Muestra un mensaje de error en el elemento `registerErrorMessage`.
 * @param {string} message - El mensaje de error a mostrar.
 */
function showErrorMessage(message) {
    if (registerErrorMessage) {
        registerErrorMessage.textContent = message;
        registerErrorMessage.classList.add('active');
    }
}

/**
 * Oculta el mensaje de error.
 */
function hideErrorMessage() {
    if (registerErrorMessage) {
        registerErrorMessage.textContent = '';
        registerErrorMessage.classList.remove('active');
    }
}
