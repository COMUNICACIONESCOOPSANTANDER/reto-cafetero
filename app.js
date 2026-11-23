
// ============================================
// RETO CAFETERO - COOPERATIVA DE CAFICULTORES
// ============================================

const SUPABASE_URL = "https://voqdqsoxlqwplhfjchrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_NgaynrOUy74BRpZF-6x5kw_HkjhehPz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// VARIABLES
let participanteId = null;
let dinamicaActual = null;
let preguntas = [];
let preguntaActual = 0;
let intentoId = null;
let puntosTotales = 0;
let inicioPregunta = 0;
let temporizador = null;
let segundos = 20;
let respondiendo = false;

// ELEMENTOS HTML
const $ = id => document.getElementById(id);

// CAMBIAR DE PANTALLA
function mostrar(pantalla) {
  document.querySelectorAll(".pantalla").forEach(p => {
    p.classList.add("oculto");
  });

  $(pantalla).classList.remove("oculto");
}

// MENSAJES
function mensaje(texto) {
  alert(texto);
}

// BOTÓN COMENZAR
$("btn-comenzar").addEventListener("click", () => {
  mostrar("pantalla-registro");
});

// ============================================
// REGISTRO DE PARTICIPANTE
// ============================================

$("form-registro").addEventListener("submit", async e => {
  e.preventDefault();

  const nombre = $("nombre").value.trim();

  if (!nombre) {
    return mensaje("Escribe tu nombre completo.");
  }

  const boton = e.target.querySelector('button[type="submit"]');
  boton.disabled = true;
  boton.textContent = "REGISTRANDO...";

  try {
    const { error: authError } =
      await db.auth.signInAnonymously();

    if (authError) throw authError;

    const { data, error } = await db.rpc(
      "register_participant",
      { p_name: nombre }
    );

    if (error) throw error;

    participanteId = data;

    await cargarSemanas();

  } catch (error) {
    console.error("Error de registro:", error);
    mensaje("No se pudo registrar: " + error.message);

  } finally {
    boton.disabled = false;
    boton.textContent = "REGISTRARME";
  }
});

// ============================================
// CARGAR SEMANAS
// ============================================

async function cargarSemanas() {
  try {
    const { data, error } = await db
      .from("weeks")
      .select("*")
      .order("id");

    if (error) throw error;

    const lista = $("lista-semanas");
    lista.innerHTML = "";

    data.forEach(semana => {
      const boton = document.createElement("button");
      boton.className = "btn-principal";
      boton.textContent = semana.title || `Semana ${semana.id}`;

      boton.addEventListener("click", () => {
        cargarDinamicas(semana.id);
      });

      lista.appendChild(boton);
    });

    mostrar("pantalla-semanas");

  } catch (error) {
    console.error("Error al cargar semanas:", error);
    mensaje("No se pudieron cargar las semanas: " + error.message);
  }
}

// ============================================
// CARGAR DINÁMICAS
// ============================================

async function cargarDinamicas(semanaId) {
  try {
    const { data, error } = await db
      .from("dynamics")
      .select("*")
      .eq("week_id", semanaId)
      .eq("is_active", true)
      .order("number");

    if (error) throw error;

    const lista = $("lista-dinamicas");
    lista.innerHTML = "";

    data.forEach(dinamica => {
      const boton = document.createElement("button");
      boton.className = "btn-principal";
      boton.textContent = dinamica.title || `Reto ${dinamica.number}`;

      boton.addEventListener("click", () => {
        iniciarReto(dinamica);
      });

      lista.appendChild(boton);
    });

    if (!data.length) {
      lista.textContent = "No hay retos activos todavía.";
    }

    mostrar("pantalla-dinamicas");

  } catch (error) {
    console.error("Error al cargar dinámicas:", error);
    mensaje("No se pudieron cargar los retos: " + error.message);
  }
}

// ============================================
// INICIAR RETO
// ============================================

async function iniciarReto(dinamica) {
  dinamicaActual = dinamica;
  preguntaActual = 0;
  puntosTotales = 0;
  respondiendo = false;

  try {
    // CONSULTAR LA TABLA CORRECTA
    const { data, error } = await db
      .from("game_questions")
      .select("*")
      .eq("dynamic_id", dinamica.id)
      .order("number");

    if (error) throw error;

    if (!data || data.length === 0) {
      return mensaje("Este reto todavía no tiene preguntas.");
    }

    preguntas = data;

    // Verificar que las preguntas tengan respuesta correcta
    if (preguntas.some(p => !p.correct_answer)) {
      return mensaje(
        "Las preguntas no están entregando la respuesta correcta. " +
        "Debemos revisar la configuración de game_questions en Supabase."
      );
    }

    // CREAR INTENTO
    const { data: intento, error: errorIntento } =
      await db.from("attempts")
        .insert({
          participant_id: participanteId,
          dynamic_id: dinamica.id,
          status: "in_progress",
          total_points: 0
        })
        .select("id")
        .single();

    if (errorIntento) throw errorIntento;

    intentoId = intento.id;

    mostrar("pantalla-juego");
    mostrarPregunta();

  } catch (error) {
    console.error("Error al iniciar reto:", error);
    mensaje("No se pudo iniciar el reto: " + error.message);
  }
}

// ============================================
// MOSTRAR PREGUNTA
// ============================================

function mostrarPregunta() {
  clearInterval(temporizador);
  temporizador = null;
  respondiendo = false;

  if (preguntaActual >= preguntas.length) {
    finalizarReto();
    return;
  }

  const pregunta = preguntas[preguntaActual];

  segundos = pregunta.time_limit_seconds || 20;
  inicioPregunta = Date.now();

  $("numero-pregunta").textContent =
    `Pregunta ${preguntaActual + 1} de ${preguntas.length}`;

  $("cronometro").textContent = segundos;
  $("puntos").textContent = `${puntosTotales} puntos`;
  $("enunciado-pregunta").textContent = pregunta.prompt;
  $("mensaje-respuesta").textContent = "";

  $("barra-progreso").style.width =
    `${(preguntaActual / preguntas.length) * 100}%`;

  const opciones = $("opciones-respuesta");
  opciones.innerHTML = "";

  let respuestas = pregunta.options || [];

  if (typeof respuestas === "string") {
    try {
      respuestas = JSON.parse(respuestas);
    } catch {
      respuestas = respuestas.split(",");
    }
  }

  if (!Array.isArray(respuestas)) {
    respuestas = [];
  }

  respuestas.forEach(opcion => {
    const boton = document.createElement("button");
    boton.className = "btn-principal";
    boton.textContent = opcion;

    boton.addEventListener("click", () => {
      responder(opcion);
    });

    opciones.appendChild(boton);
  });

  temporizador = setInterval(() => {
    segundos--;
    $("cronometro").textContent = segundos;

    if (segundos <= 0) {
      responder(null);
    }
  }, 1000);
}

// ============================================
// RESPONDER PREGUNTA
// ============================================

async function responder(respuesta) {
  if (respondiendo || temporizador === null) return;

  respondiendo = true;

  clearInterval(temporizador);
  temporizador = null;

  const pregunta = preguntas[preguntaActual];

  const tiempoMs = Math.min(
    Date.now() - inicioPregunta,
    20000
  );

  const correcta =
    respuesta !== null &&
    String(respuesta).trim().toLowerCase() ===
    String(pregunta.correct_answer).trim().toLowerCase();

  let puntos = 0;

  if (correcta) {
    let bonus = 0;

    if (tiempoMs <= 5000) {
      bonus = 500;
    } else if (tiempoMs <= 10000) {
      bonus = 300;
    } else if (tiempoMs <= 15000) {
      bonus = 100;
    }

    puntos = (pregunta.base_points || 1000) + bonus;

    if (pregunta.is_double) {
      puntos *= 2;
    }

    puntosTotales += puntos;
  }

  $("puntos").textContent = `${puntosTotales} puntos`;

  $("mensaje-respuesta").textContent = correcta
    ? `¡Correcto! +${puntos} puntos`
    : "Respuesta incorrecta.";

  $("opciones-respuesta")
    .querySelectorAll("button")
    .forEach(boton => boton.disabled = true);

  try {
    const { error } = await db
      .from("responses")
      .insert({
        attempt_id: intentoId,
        question_id: pregunta.id,
        answer: respuesta || "",
        is_correct: correcta
      });

    if (error) throw error;

    preguntaActual++;

    setTimeout(() => {
      mostrarPregunta();
    }, 1200);

  } catch (error) {
    console.error("Error al guardar respuesta:", error);
    mensaje("No se pudo guardar la respuesta: " + error.message);
    respondiendo = false;
  }
}

// ============================================
// FINALIZAR RETO
// ============================================

async function finalizarReto() {
  clearInterval(temporizador);
  temporizador = null;

  try {
    const { error } = await db
      .from("attempts")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        total_points: puntosTotales
      })
      .eq("id", intentoId);

    if (error) throw error;

    $("puntuacion-final").textContent = puntosTotales;

    $("detalle-puntuacion").textContent =
      "Has terminado todas las preguntas de este reto.";

    $("barra-progreso").style.width = "100%";

    mostrar("pantalla-resultados");

  } catch (error) {
    console.error("Error al finalizar:", error);
    mensaje("No se pudieron guardar los resultados: " + error.message);
  }
}

// ============================================
// CONTINUAR
// ============================================

$("btn-continuar").addEventListener("click", () => {
  if (dinamicaActual) {
    cargarDinamicas(dinamicaActual.week_id);
  }
});

// ============================================
// FIN
// ============================================

console.log("RETO CAFETERO conectado a Supabase.");
