
const SUPABASE_URL = "https://voqdqsoxlqwplhfjchrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_NgaynrOUy74BRpZF-6x5kw_HkjhehPz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let participanteId = null;
let dinamicaActual = null;
let preguntas = [];
let preguntaActual = 0;
let intentoId = null;
let puntosTotales = 0;
let inicioPregunta = 0;
let temporizador = null;
let segundos = 20;

const $ = id => document.getElementById(id);

function mostrar(pantalla) {
  document.querySelectorAll(".pantalla").forEach(p => p.classList.add("oculto"));
  $(pantalla).classList.remove("oculto");
}

function mensaje(texto) {
  alert(texto);
}

$("btn-comenzar").addEventListener("click", () => {
  mostrar("pantalla-registro");
});

$("form-registro").addEventListener("submit", async e => {
  e.preventDefault();

  const nombre = $("nombre").value.trim();

  if (!nombre) return mensaje("Escribe tu nombre completo.");

  try {
    const { data: auth, error: authError } =
      await db.auth.signInAnonymously();

    if (authError) throw authError;

    const { data, error } = await db
      .from("participants")
      .insert({
        display_name: nombre,
        normalized_name: nombre.toLowerCase().trim()
      })
      .select("id")
      .single();

    if (error) throw error;

    participanteId = data.id;
    await cargarSemanas();

  } catch (error) {
    console.error(error);
    mensaje("No se pudo registrar. Revisa la conexión o los permisos de Supabase.");
  }
});

async function cargarSemanas() {
  const { data, error } = await db
    .from("weeks")
    .select("*")
    .order("id");

  if (error) return mensaje("No se pudieron cargar las semanas.");

  const lista = $("lista-semanas");
  lista.innerHTML = "";

  data.forEach(semana => {
    const boton = document.createElement("button");
    boton.className = "btn-principal";
    boton.textContent = semana.title || `Semana ${semana.id}`;
    boton.addEventListener("click", () => cargarDinamicas(semana.id));
    lista.appendChild(boton);
  });

  mostrar("pantalla-semanas");
}

async function cargarDinamicas(semanaId) {
  const { data, error } = await db
    .from("dynamics")
    .select("*")
    .eq("week_id", semanaId)
    .eq("is_active", true)
    .order("number");

  if (error) return mensaje("No se pudieron cargar los retos.");

  const lista = $("lista-dinamicas");
  lista.innerHTML = "";

  data.forEach(dinamica => {
    const boton = document.createElement("button");
    boton.className = "btn-principal";
    boton.textContent = dinamica.title || `Reto ${dinamica.number}`;
    boton.addEventListener("click", () => iniciarReto(dinamica));
    lista.appendChild(boton);
  });

  if (!data.length) lista.textContent = "No hay retos activos todavía.";

  mostrar("pantalla-dinamicas");
}

async function iniciarReto(dinamica) {
  dinamicaActual = dinamica;
  preguntaActual = 0;
  puntosTotales = 0;

  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("dynamic_id", dinamica.id)
    .eq("is_active", true)
    .order("number");

  if (error) return mensaje("No se pudieron cargar las preguntas.");

  if (!data.length) return mensaje("Este reto todavía no tiene preguntas.");

  preguntas = data;

  const { data: intento, error: errorIntento } = await db
    .from("attempts")
    .insert({
      participant_id: participanteId,
      dynamic_id: dinamica.id,
      status: "in_progress",
      total_points: 0
    })
    .select("id")
    .single();

  if (errorIntento) {
    console.error(errorIntento);
    return mensaje("No se pudo iniciar el reto. Revisa los permisos de Supabase.");
  }

  intentoId = intento.id;
  mostrar("pantalla-juego");
  mostrarPregunta();
}

function mostrarPregunta() {
  clearInterval(temporizador);

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

  (pregunta.options || []).forEach(opcion => {
    const boton = document.createElement("button");
    boton.className = "btn-principal";
    boton.textContent = opcion;
    boton.addEventListener("click", () => responder(opcion));
    opciones.appendChild(boton);
  });

  temporizador = setInterval(() => {
    segundos--;
    $("cronometro").textContent = segundos;

    if (segundos <= 0) responder(null);
  }, 1000);
}

async function responder(respuesta) {
  if (!temporizador) return;

  clearInterval(temporizador);
  const pregunta = preguntas[preguntaActual];
  const tiempoMs = Math.min(Date.now() - inicioPregunta, 20000);
  const correcta = respuesta !== null &&
    String(respuesta).trim().toLowerCase() ===
    String(pregunta.correct_answer).trim().toLowerCase();

  let puntos = 0;

  if (correcta) {
    const bonus = tiempoMs <= 5000 ? 500 :
      tiempoMs <= 10000 ? 300 :
      tiempoMs <= 15000 ? 100 : 0;

    puntos = (pregunta.base_points || 1000) + bonus;

    if (pregunta.is_double) puntos *= 2;

    puntosTotales += puntos;
  }

  $("puntos").textContent = `${puntosTotales} puntos`;
  $("mensaje-respuesta").textContent =
    correcta ? `¡Correcto! +${puntos} puntos` : "Respuesta incorrecta.";

  const botones = $("opciones-respuesta").querySelectorAll("button");
  botones.forEach(b => b.disabled = true);

  const { error } = await db.from("responses").insert({
    attempt_id: intentoId,
    question_id: pregunta.id,
    answer: respuesta || "",
    is_correct: correcta,
    response_time_ms: tiempoMs,
    points_awarded: puntos
  });

  if (error) {
    console.error(error);
    mensaje("No se pudo guardar tu respuesta.");
    return;
  }

  preguntaActual++;

  setTimeout(mostrarPregunta, 1200);
}

async function finalizarReto() {
  clearInterval(temporizador);

  await db.from("attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      total_points: puntosTotales
    })
    .eq("id", intentoId);

  $("puntuacion-final").textContent = puntosTotales;
  $("detalle-puntuacion").textContent =
    "Has terminado todas las preguntas de este reto.";

  mostrar("pantalla-resultados");
}

$("btn-continuar").addEventListener("click", () => {
  cargarDinamicas(dinamicaActual.week_id);
});
