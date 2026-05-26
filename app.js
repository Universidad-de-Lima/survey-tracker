// QR/app.js

const BACKEND_API_URL = 'https://your-serverless-function-url.vercel.app/api/get-counts'; // ¡IMPORTANTE: Reemplaza con la URL real de tu función serverless!

const totalScansElement = document.getElementById('totalScans');
const completedSurveysElement = document.getElementById('completedSurveys');
const pendingRespondentsElement = document.getElementById('pendingRespondents');

let lastScans = 0;
let lastCompleted = 0;

async function updateCounters() {
    try {
        const response = await fetch(BACKEND_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const currentScans = data.scanned || 0;
        const currentCompleted = data.completed || 0;

        // Actualizar Escaneos Totales con animación
        if (currentScans !== lastScans) {
            animateCounter(totalScansElement, lastScans, currentScans);
            triggerNewResponseIndicator(totalScansElement.parentElement);
            lastScans = currentScans;
        }

        // Actualizar Encuestas Completadas con animación
        if (currentCompleted !== lastCompleted) {
            animateCounter(completedSurveysElement, lastCompleted, currentCompleted);
            triggerNewResponseIndicator(completedSurveysElement.parentElement);
            lastCompleted = currentCompleted;
        }

        // Calcular y actualizar Encuestados Pendientes
        const pending = Math.max(0, currentScans - currentCompleted);
        if (pending !== parseInt(pendingRespondentsElement.textContent)) {
            animateCounter(pendingRespondentsElement, parseInt(pendingRespondentsElement.textContent), pending);
        }

    } catch (error) {
        console.error("Error al obtener los datos del backend:", error);
        // Aquí podrías mostrar un mensaje de error en la UI si lo deseas
    }
}

function animateCounter(element, startValue, endValue) {
    const duration = 1000; // milisegundos
    const startTime = performance.now();

    function update(currentTime) {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function triggerNewResponseIndicator(cardElement) {
    const indicator = cardElement.querySelector('.new-response-indicator');
    if (indicator) {
        indicator.classList.remove('hidden');
        // Ocultar después de un tiempo
        setTimeout(() => {
            indicator.classList.add('hidden');
        }, 3000); // El indicador se oculta después de 3 segundos
    }
}

// Iniciar la primera actualización inmediatamente
updateCounters();

// Configurar el polling automático cada 5 segundos
setInterval(updateCounters, 5000); // Actualiza cada 5 segundos

// Opcional: Para el contador de escaneos más preciso, si el QR apunta a una URL serverless que redirige:
// Podrías tener una función en el backend que registre el escaneo y luego redirija a la URL de la encuesta.
// El contador de `scanned` en el backend debería ser actualizado por esa función.
// En este frontend, simplemente lo mostramos. Si `BACKEND_API_URL` provee el dato `scanned`, es suficiente.

// Para inicializar los contadores en 0 al cargar la página si el backend no ha respondido aún
totalScansElement.textContent = '0';
completedSurveysElement.textContent = '0';
pendingRespondentsElement.textContent = '0';
