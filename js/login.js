// js/login.js
// Importa las funciones necesarias de Firebase Auth y Firestore desde firebase-init.js
import { auth, db } from './firebase-init.js';
import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast, showGenericMessageModal } from './utils.js'; // Importa las funciones de utilidad

// Elementos del DOM del formulario de login
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorMessage = document.getElementById('login-error-message');

// Asegúrate de que el DOM esté completamente cargado antes de añadir listeners
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si los elementos del formulario existen antes de añadir el listener
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    } else {
        console.error("login.js: Formulario de login no encontrado.");
    }
});

/**
 * Maneja el envío del formulario de inicio de sesión.
 * @param {Event} e - El evento de envío del formulario.
 */
async function handleLogin(e) {
    e.preventDefault(); // Evitar la recarga de la página

    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!email || !password) {
        showErrorMessage("Por favor, ingresa tu correo y contraseña.");
        return;
    }

    // Ocultar mensaje de error previo
    hideErrorMessage();
    showToast("Iniciando sesión...", "info");

    try {
        // Asegúrate de que 'auth' esté disponible globalmente a través de window.auth
        if (!window.auth) {
            showErrorMessage("Error: Firebase Auth no está inicializado. Recargue la página.");
            return;
        }

        const userCredential = await signInWithEmailAndPassword(window.auth, email, password);
        const user = userCredential.user;
        console.log("Usuario ha iniciado sesión:", user.uid);

        // Opcional: Crear/actualizar un documento de usuario en Firestore si no existe
        // Esto es útil para almacenar datos de perfil adicionales (nombre, etc.)
        if (window.db) {
            const userDocRef = doc(window.db, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || email.split('@')[0], // Usar displayName o parte del email
                    registeredAt: new Date(),
                    isAnonymous: false // Asegurar que no es anónimo
                }, { merge: true });
                console.log("Documento de usuario creado/actualizado en Firestore para:", user.uid);
            }
        } else {
            console.warn("Firestore (db) no está inicializado. No se puede crear/actualizar documento de usuario.");
        }

        showToast("¡Inicio de sesión exitoso!", "success");
        setTimeout(() => {
            // Redirigir al usuario a la página principal o a su cuenta
            window.location.href = 'index.html'; 
        }, 1500);

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        let errorMessage = "Error al iniciar sesión.";
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = "El formato del correo electrónico no es válido.";
                break;
            case 'auth/user-disabled':
                errorMessage = "Tu cuenta ha sido deshabilitada.";
                break;
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential': // Para Firebase v10+
                errorMessage = "Correo o contraseña incorrectos.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.";
                break;
            default:
                errorMessage += ` ${error.message}`;
                break;
        }
        showErrorMessage(errorMessage);
        showToast(errorMessage, "error");
    }
}

/**
 * Muestra un mensaje de error en el elemento `loginErrorMessage`.
 * @param {string} message - El mensaje de error a mostrar.
 */
function showErrorMessage(message) {
    if (loginErrorMessage) {
        loginErrorMessage.textContent = message;
        loginErrorMessage.classList.add('active');
    }
}

/**
 * Oculta el mensaje de error.
 */
function hideErrorMessage() {
    if (loginErrorMessage) {
        loginErrorMessage.textContent = '';
        loginErrorMessage.classList.remove('active');
    }
}
