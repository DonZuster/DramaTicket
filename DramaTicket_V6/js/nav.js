// js/nav.js
import { auth, db } from './firebase-init.js'; // Importa auth y db desde firebase-init.js
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { createElement } from './utils.js'; // Importa createElement


// UID del administrador - ¡DEBE COINCIDIR CON EL DE admin.js Y LAS REGLAS DE FIREBASE!
const ADMIN_UID = 'poQqw14QiYVb2Y05vQKS5dPLsPE2'; 

document.addEventListener('DOMContentLoaded', () => {
    console.log("nav.js: DOMContentLoaded - Iniciando.");
    const navContainer = document.getElementById('main-nav');
    if (!navContainer) {
        console.error("nav.js: Contenedor de navegación no encontrado.");
        return;
    }

    navContainer.innerHTML = ''; // Limpiar el contenido del navContainer para reconstruirlo

    const nav = createElement('nav', [], {}, [
        createElement('div', ['logo'], {}, [
            createElement('a', [], { href: 'index.html' }, [
                createElement('img', [], { src: 'img/logo.png', alt: 'TeatroWeb Logo' })
            ])
        ]),
        createElement('ul', ['nav-links'], { id: 'navLinks' }, [
            createElement('li', [], {}, [createElement('a', [], { href: 'index.html' }, 'Inicio')]),
            createElement('li', [], {}, [createElement('a', [], { href: 'index.html#all-events-section' }, 'Eventos')]),
            createElement('li', [], {}, [createElement('a', [], { href: 'contact.html' }, 'Contacto')]) // Añadido enlace a Contacto
        ]),
        createElement('div', ['auth-links'], { id: 'authLinksContainer' }, []) // Contenedor para enlaces de autenticación
    ]);

    navContainer.appendChild(nav);

    const authLinksContainer = document.getElementById('authLinksContainer');

    // Escuchar el estado de autenticación de Firebase.
    const checkFirebaseReady = setInterval(() => {
        if (typeof window.auth !== 'undefined' && typeof window.db !== 'undefined') {
            clearInterval(checkFirebaseReady); // Detener el chequeo una vez que estén disponibles
            
            onAuthStateChanged(auth, async (user) => { 
                authLinksContainer.innerHTML = ''; // Limpiar enlaces existentes

                if (user && !user.isAnonymous) {
                    // Usuario REALMENTE autenticado (no anónimo)
                    console.log("nav.js: Usuario autenticado (no anónimo):", user.uid, user.email);
                    let userName = user.email; // Valor por defecto

                    // Intentar obtener el nombre del documento de usuario en Firestore
                    try {
                        const userDocRef = doc(db, 'users', user.uid); 
                        const userDocSnap = await getDoc(userDocRef);
                        if (userDocSnap.exists() && userDocSnap.data().name) {
                            userName = userDocSnap.data().name;
                        } else {
                            console.warn("nav.js: Nombre no encontrado en el documento de usuario de Firestore para UID:", user.uid, ". Usando email o displayName.");
                            userName = user.displayName || user.email; // Fallback
                        }
                    } catch (error) {
                        console.error("nav.js: Error al obtener datos de usuario de Firestore:", error);
                        userName = user.displayName || user.email; // Fallback
                    }

                    // Reconstrucción de los elementos de autenticación para el estilo original
                    const authElements = [];

                    // Agregar enlace "Mi Cuenta" con clase blanco y negro
                    authElements.push(createElement('a', ['btn-header-auth', 'my-account-btn'], { href: 'my-account.html' }, 'Mi Cuenta'));

                    // Agregar enlace "Administración" si es admin con clase blanco y negro
                    if (user.uid === ADMIN_UID) {
                        authElements.push(createElement('a', ['btn-header-auth', 'admin-btn'], { href: 'admin.html' }, 'Administración'));
                    }

                    // Agregar el nombre de usuario
                    // authElements.push(createElement('span', ['user-name-display'], {}, userName));

                    // Agregar botón "Cerrar Sesión" (este ya toma el color rojo por defecto de .btn-header-auth)
                    authElements.push(createElement('button', ['btn-header-auth', 'logout-btn'], { id: 'logout-btn' }, 'Cerrar Sesión'));
                    
                    // Añadir todos los elementos al contenedor
                    authElements.forEach(el => authLinksContainer.appendChild(el));

                    // Añadir listener para cerrar sesión
                    const logoutBtn = document.getElementById('logout-btn');
                    if (logoutBtn) { 
                        logoutBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            try {
                                await auth.signOut(); 
                                console.log("Usuario ha cerrado sesión.");
                                window.location.href = 'index.html'; // Redirigir a la página principal
                            } catch (error) {
                                console.error("Error al cerrar sesión:", error);
                            }
                        });
                    }

                } else {
                    // Usuario no autenticado o es anónimo
                    console.log("nav.js: Usuario no autenticado o anónimo - Mostrando enlaces de login/registro.");
                    // Botón de Iniciar Sesión (toma el estilo rojo por defecto de .btn-header-auth)
                    authLinksContainer.appendChild(createElement('a', ['btn-header-auth'], { href: 'login.html' }, 'Iniciar Sesión'));
                    // Botón de Crear Cuenta (toma el estilo rojo por defecto de .btn-header-auth)
                    authLinksContainer.appendChild(createElement('a', ['btn-header-auth'], { href: 'register.html' }, 'Crear Cuenta'));
                }
            });
        }
    }, 100); // Chequear cada 100ms hasta que Firebase esté listo

    // Actualizar enlaces del footer dinámicamente
    const footerLinksSection = document.querySelector('footer .footer-section.links ul');
    if (footerLinksSection) { 
        footerLinksSection.innerHTML = `
            <li><a href="index.html">Inicio</a></li>
            <li><a href="index.html#all-events-section">Eventos</a></li>
            <li><a href="my-account.html">Mi Cuenta</a></li>
            <li><a href="faq.html">Preguntas Frecuentes</a></li>
            <li><a href="terms.html">Términos y Condiciones</a></li>
            <li><a href="contact.html">Contacto</a></li>
        `;
    }
});
