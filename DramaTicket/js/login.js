// js/login.js
// Importa las funciones necesarias de Firebase Auth y Firestore
import { auth } from './firebase-init.js';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { showToast } from './utils.js';

// ---------------------------
// Referencias al DOM
// ---------------------------
const loginForm = document.getElementById('login-form');
const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');
const loginErrorMessage = document.getElementById('login-error-message');

const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const togglePasswordBtn = document.getElementById('toggle-password-visibility');

// Aseguramos listeners cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  } else {
    console.error('login.js: Formulario de login no encontrado.');
  }

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', handleForgotPassword);
  }

  if (togglePasswordBtn && loginPasswordInput) {
    togglePasswordBtn.addEventListener('click', togglePasswordVisibility);
  }
});

// ---------------------------
// Inicio de sesión
// ---------------------------
async function handleLogin(e) {
  e.preventDefault();

  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value.trim();

  if (!email || !password) {
    showErrorMessage('Por favor, ingresa tu correo y contraseña.');
    return;
  }

  hideErrorMessage();
  showToast('Iniciando sesión...', 'info');

  try {
    const authInstance = window.auth || auth;
    if (!authInstance) {
      showErrorMessage(
        'Error: Firebase Auth no está inicializado. Recarga la página.'
      );
      return;
    }

    const userCredential = await signInWithEmailAndPassword(
      authInstance,
      email,
      password
    );
    const user = userCredential.user;
    console.log('Usuario ha iniciado sesión:', user.uid);

    // Crear/actualizar doc de usuario si no existe
    if (window.db) {
      const userDocRef = doc(window.db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(
          userDocRef,
          {
            uid: user.uid,
            email: user.email,
            name: user.displayName || email.split('@')[0],
            registeredAt: new Date(),
            isAnonymous: false
          },
          { merge: true }
        );
        console.log(
          'Documento de usuario creado/actualizado en Firestore para:',
          user.uid
        );
      }
    } else {
      console.warn(
        'Firestore (db) no está inicializado. No se puede crear/actualizar documento de usuario.'
      );
    }

    showToast('¡Inicio de sesión exitoso!', 'success');

    setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect');

      if (redirect) {
        window.location.href = redirect;
      } else {
        window.location.href = 'index.html';
      }
    }, 1500);


  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    let errorMessage = 'Error al iniciar sesión.';

    switch (error.code) {
      case 'auth/invalid-email':
        errorMessage = 'El formato del correo electrónico no es válido.';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Tu cuenta ha sido deshabilitada.';
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        errorMessage = 'Correo o contraseña incorrectos.';
        break;
      case 'auth/too-many-requests':
        errorMessage =
          'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.';
        break;
      default:
        errorMessage += ` ${error.message}`;
        break;
    }

    showErrorMessage(errorMessage);
    showToast(errorMessage, 'error');
  }
}

// ---------------------------
// Recuperar contraseña
// ---------------------------
async function handleForgotPassword() {
  const email = loginEmailInput.value.trim();

  if (!email) {
    showErrorMessage(
      'Ingresa tu correo electrónico para poder enviarte el enlace de recuperación.'
    );
    loginEmailInput.focus();
    return;
  }

  hideErrorMessage();
  showToast('Enviando correo de recuperación...', 'info');

  try {
    const authInstance = window.auth || auth;
    await sendPasswordResetEmail(authInstance, email);

    showToast(
      `Si la cuenta existe, se ha enviado un correo para restablecer la contraseña a ${email}.`,
      'success'
    );
  } catch (error) {
    console.error('Error al enviar correo de recuperación:', error);
    let msg = 'No se pudo enviar el correo de recuperación.';

    if (error.code === 'auth/invalid-email') {
      msg = 'El correo ingresado no es válido.';
    } else if (error.code === 'auth/user-not-found') {
      msg = 'No existe un usuario registrado con ese correo.';
    } else {
      msg += ` ${error.message}`;
    }

    showErrorMessage(msg);
    showToast(msg, 'error');
  }
}

// ---------------------------
// Mostrar / ocultar contraseña
// ---------------------------
function togglePasswordVisibility() {
  if (!loginPasswordInput) return;

  const isPassword = loginPasswordInput.type === 'password';
  loginPasswordInput.type = isPassword ? 'text' : 'password';

  const icon = togglePasswordBtn?.querySelector('i');
  if (icon) {
    icon.classList.toggle('fa-eye', !isPassword);
    icon.classList.toggle('fa-eye-slash', isPassword);
  }
}

// ---------------------------
// Helpers de error visual
// ---------------------------
function showErrorMessage(message) {
  if (loginErrorMessage) {
    loginErrorMessage.textContent = message;
    loginErrorMessage.classList.add('active');
  }
}

function hideErrorMessage() {
  if (loginErrorMessage) {
    loginErrorMessage.textContent = '';
    loginErrorMessage.classList.remove('active');
  }
}
