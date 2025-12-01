// js/auth.js
// Este archivo maneja la lógica de registro e inicio de sesión

import { auth, db } from './firebase-init.js'; // Importa auth y db desde firebase-init.js
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'; // Importa getDoc para verificar existencia de doc de usuario
import { showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica para el formulario de Registro ---
    const registerForm = document.getElementById('register-form');
    const registerErrorMessage = document.getElementById('register-error-message');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('register-name').value.trim();
            const email = document.getElementById('register-email').value.trim();
            const password = document.getElementById('register-password').value;
            const confirmPassword = document.getElementById('register-confirm-password').value;

            // Limpiar mensaje de error anterior
            registerErrorMessage.textContent = '';
            registerErrorMessage.classList.remove('active');

            if (password !== confirmPassword) {
                registerErrorMessage.textContent = 'Las contraseñas no coinciden.';
                registerErrorMessage.classList.add('active');
                return;
            }
            if (password.length < 6) {
                registerErrorMessage.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                registerErrorMessage.classList.add('active');
                return;
            }

            try {
                // Crear usuario en Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Actualizar el perfil del usuario (nombre de visualización)
                await updateProfile(user, { displayName: name });

                // Guardar información adicional del usuario en Firestore
                // Primero verifica si el documento ya existe para evitar sobrescribir si el usuario
                // ya se autenticó anónimamente y ya tiene un doc
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        email: user.email,
                        name: name,
                        registeredAt: new Date(), // Guardar el timestamp de registro
                    }, { merge: true }); // Usar merge para no borrar datos si ya existen (ej. de anónimo)
                } else {
                     // Si ya existe, actualiza el nombre y el email si es necesario
                     await setDoc(userDocRef, {
                        name: name,
                        email: user.email, // Asegurarse de que el email esté actualizado
                        // No actualizar registeredAt si ya existe
                    }, { merge: true });
                }

                showToast('¡Cuenta creada exitosamente! Redirigiendo...', 'success');
                console.log('Usuario registrado y perfil en Firestore:', user.uid, user.email, name);

                // Redirigir al usuario después de un breve retraso
                setTimeout(() => {
                    window.location.href = 'my-account.html'; // O index.html o login.html
                }, 2000);

            } catch (error) {
                console.error('Error al registrar usuario:', error);
                let errorMessage = 'Error al crear la cuenta.';
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = 'El correo electrónico ya está en uso.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'El formato del correo electrónico es inválido.';
                        break;
                    case 'auth/weak-password':
                        errorMessage = 'La contraseña es demasiado débil.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Error de red. Verifica tu conexión a internet.';
                        break;
                    default:
                        errorMessage += ` (${error.message})`;
                        break;
                }
                registerErrorMessage.textContent = errorMessage;
                registerErrorMessage.classList.add('active');
            }
        });
    }

    // --- Lógica para el formulario de Inicio de Sesión ---
    const loginForm = document.getElementById('login-form');
    const loginErrorMessage = document.getElementById('login-error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;

            // Limpiar mensaje de error anterior
            loginErrorMessage.textContent = '';
            loginErrorMessage.classList.remove('active');

            try {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
                console.log('Usuario ha iniciado sesión:', auth.currentUser.uid);

                // Redirigir al usuario después de un breve retraso
                setTimeout(() => {
                    window.location.href = 'my-account.html'; // O index.html
                }, 2000);

            } catch (error) {
                console.error('Error al iniciar sesión:', error);
                let errorMessage = 'Error al iniciar sesión.';
                switch (error.code) {
                    case 'auth/invalid-email':
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Credenciales inválidas (correo o contraseña incorrectos).';
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = 'Demasiados intentos fallidos. Intenta de nuevo más tarde.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Error de red. Verifica tu conexión a internet.';
                        break;
                    default:
                        errorMessage += ` (${error.message})`;
                        break;
                }
                loginErrorMessage.textContent = errorMessage;
                loginErrorMessage.classList.add('active');
            }
        });
    }
});
