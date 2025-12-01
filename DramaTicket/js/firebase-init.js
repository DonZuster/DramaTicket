// js/firebase-init.js

// Importa los módulos necesarios de Firebase (versiones modulares)
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// Importa tu configuración de Firebase desde el archivo local
import { firebaseConfig as localFirebaseConfig } from './firebase-config.js';

let app;
let auth;
let db;
let storage;
let analytics;

// Determina la configuración de Firebase a usar (prioriza la del entorno si existe)
let effectiveFirebaseConfig = localFirebaseConfig;
if (typeof __firebase_config !== 'undefined' && __firebase_config && __firebase_config.trim() !== '') {
    try {
        const envConfig = JSON.parse(__firebase_config);
        if (Object.keys(envConfig).length > 0 && envConfig.apiKey) {
            effectiveFirebaseConfig = envConfig;
            console.log("Usando configuración de Firebase del entorno (Canvas).");
        } else {
            console.warn("La configuración de Firebase del entorno está vacía o incompleta. Usando configuración de firebase-config.js.");
        }
    } catch (e) {
        console.error("Error al parsear __firebase_config del entorno:", e);
        console.warn("Usando configuración de Firebase de firebase-config.js como respaldo.");
    }
} else {
    console.log("La variable __firebase_config del entorno no está definida o está vacía. Usando configuración de firebase-config.js.");
}

// Define el appId (siempre usa el del entorno si está disponible, o un valor predeterminado)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Inicialización de Firebase (siempre inicializar con modular) ---
try {
    app = initializeApp(effectiveFirebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    analytics = getAnalytics(app);
    console.log("Firebase App, Auth, Firestore, Storage y Analytics inicializados.");

    // Hacer las instancias de Firebase globales para que otros módulos puedan acceder
    window.app = app;
    window.auth = auth;
    window.db = db;
    window.storage = storage;
    window.analytics = analytics;
    window.appId = appId;
    console.log("Instancias de Firebase puestas en el objeto global 'window'.");

    // Configurar persistencia de autenticación ANTES de cualquier intento de inicio de sesión.
    // Esto asegura que las sesiones (incluida la de email/password) se mantengan.
    setPersistence(auth, browserLocalPersistence)
        .then(() => {
            console.log("Persistencia de autenticación de Firebase establecida a 'local'.");
        })
        .catch((error) => {
            console.error("Error al establecer la persistencia de autenticación:", error);
        });

} catch (error) {
    console.error("Error al inicializar Firebase en firebase-init.js:", error);
}

// Variable de control para asegurar que la autenticación inicial (solo para Canvas) se intente solo una vez.
let initialCanvasAuthAttempted = false;

// Escucha cambios en el estado de autenticación de Firebase
onAuthStateChanged(auth, async (user) => {
    console.log("[onAuthStateChanged] Estado actual de autenticación:", user ? user.uid : "No user", user ? `(Anónimo: ${user.isAnonymous})` : "");

    // Si hay un usuario, y es anónimo, y no se ha intentado la autenticación inicial de Canvas,
    // o si es anónimo y el token de Canvas está presente, intenta autenticarlo con el token.
    // Esto es para asegurar que el usuario del entorno de Canvas esté bien establecido.
    if (user && user.isAnonymous && !initialCanvasAuthAttempted && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("[onAuthStateChanged] Usuario anónimo (Canvas) autenticado/ascendido con token personalizado.");
            initialCanvasAuthAttempted = true; // Marca que se intentó la autenticación de Canvas
        } catch (error) {
            console.error("[onAuthStateChanged] Error al autenticar con token personalizado (Canvas):", error);
        }
    } else if (user && !user.isAnonymous) {
        // Si el usuario NO es anónimo (es decir, inició sesión con email/password),
        // no intentaremos la autenticación de Canvas. Su sesión "real" tiene prioridad.
        initialCanvasAuthAttempted = true; // Marca que se "consideró" la autenticación de Canvas
        console.log("[onAuthStateChanged] Usuario registrado detectado. Evitando autenticación inicial de Canvas.");
    } else if (!user && !initialCanvasAuthAttempted) {
        // Si no hay usuario y aún no se ha intentado la autenticación de Canvas,
        // o si un usuario registrado se deslogueó y ahora no hay nadie, intenta la autenticación de Canvas.
        try {
            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
            if (initialAuthToken) {
                await signInWithCustomToken(auth, initialAuthToken);
                console.log("[onAuthStateChanged] Sesión iniciada con token personalizado (manejo inicial de Canvas).");
            } else {
                await signInAnonymously(auth);
                console.log("[onAuthStateChanged] Sesión iniciada de forma anónima (manejo inicial de Canvas).");
            }
            initialCanvasAuthAttempted = true;
        } catch (error) {
            console.error("[onAuthStateChanged] Error de autenticación inicial de Canvas:", error);
            if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
                console.error("La autenticación anónima o con token personalizado está deshabilitada o restringida en tu proyecto de Firebase. Por favor, habilítala en Firebase Console (Authentication -> Sign-in method).");
            }
        }
    }

    // Lógica para crear/actualizar documento de usuario anónimo en Firestore (si 'db' está disponible)
    if (user && user.isAnonymous && db) {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: null,
                name: 'Anónimo',
                registeredAt: new Date(),
                isAnonymous: true
            }, { merge: true });
            console.log("Documento de usuario anónimo creado/actualizado en Firestore:", user.uid);
        }
    } else if (!db) {
        console.warn("Firestore (db) no está inicializado en onAuthStateChanged. No se puede crear/actualizar documento de usuario.");
    }

    // Control de visibilidad del botón de cerrar sesión
    const signOutBtn = document.getElementById('sign-out-btn');
    const logoutNavBtn = document.getElementById('logout-btn');

    if (signOutBtn) {
        signOutBtn.style.display = (user && !user.isAnonymous) ? 'block' : 'none';
    }
    if (logoutNavBtn) {
        logoutNavBtn.style.display = (user && !user.isAnonymous) ? 'inline-block' : 'none';
    }

    // Redirección si el usuario no está logueado en páginas protegidas
    if (!user) {
        const currentPath = window.location.pathname.split('/').pop();
        const authenticatedPages = ['my-account.html', 'admin.html', 'payment-details.html', 'confirmacion.html'];
        if (authenticatedPages.includes(currentPath) &&
            currentPath !== 'index.html' &&
            currentPath !== 'login.html' &&
            currentPath !== 'register.html') {
             console.log(`Redirigiendo de ${currentPath} a index.html después de cerrar sesión.`);
             window.location.href = 'index.html';
        }
    }
});

// Exporta las instancias para que otros módulos puedan importarlas si es necesario
export { app, auth, db, storage, analytics };
