
// RETO CAFETERO - juego + clasificación
const SUPABASE_URL = "https://voqdqsoxlqwplhfjchrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_NgaynrOUy74BRpZF-6x5kw_HkjhehPz";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let participanteId = null, dinamicaActual = null, preguntas = [], preguntaActual = 0;
let intentoId = null, puntosTotales = 0, inicioPregunta = 0, temporizador = null;
let segundos = 20, respondiendo = false, pantallaAnteriorClasificacion = "pantalla-semanas";
let semanasDisponibles = [];
const $ = id => document.getElementById(id);

function mostrar(pantalla) {
  document.querySelectorAll(".pantalla").forEach(p => p.classList.add("oculto"));
  const destino = $(pantalla);
  if (destino) destino.classList.remove("oculto");
  else console.error(`No se encontró la pantalla: ${pantalla}`);
}
function mensaje(texto) { alert(texto); }

$("btn-comenzar")?.addEventListener("click", () => mostrar("pantalla-registro"));

$("form-registro")?.addEventListener("submit", async e => {
  e.preventDefault();
  const nombre = $("nombre")?.value.trim();
  if (!nombre) return mensaje("Escribe tu nombre completo.");
  const boton = e.target.querySelector('button[type="submit"]');
  if (boton) { boton.disabled = true; boton.textContent = "REGISTRANDO..."; }
  try {
    const { error: authError } = await db.auth.signInAnonymously();
    if (authError) throw authError;
    const { data, error } = await db.rpc("register_participant", { p_name: nombre });
    if (error) throw error;
    participanteId = data;
    await cargarSemanas();
  } catch (error) {
    console.error("Error de registro:", error);
    mensaje("No se pudo registrar: " + error.message);
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = "REGISTRARME"; }
  }
});

async function cargarSemanas() {
  try {
    const { data, error } = await db.from("weeks").select("*").order("id");
    if (error) throw error;
    semanasDisponibles = data || [];
    const lista = $("lista-semanas");
    if (!lista) throw new Error("No se encontró lista-semanas en el HTML.");
    lista.innerHTML = "";
    semanasDisponibles.forEach(semana => {
      const boton = document.createElement("button");
      boton.className = "btn-principal";
      boton.textContent = semana.title || `Semana ${semana.id}`;
      boton.addEventListener("click", () => cargarDinamicas(semana.id));
      lista.appendChild(boton);
    });
    if (!semanasDisponibles.length) lista.textContent = "Todavía no hay semanas disponibles.";
    llenarSelectorSemanasRanking();
    mostrar("pantalla-semanas");
  } catch (error) {
    console.error("Error al cargar semanas:", error);
    mensaje("No se pudieron cargar las semanas: " + error.message);
  }
}

async function cargarDinamicas(semanaId) {
  try {
    const { data, error } = await db.from("dynamics").select("*")
      .eq("week_id", semanaId).eq("is_active", true).order("number");
    if (error) throw error;
    const lista = $("lista-dinamicas");
    if (!lista) throw new Error("No se encontró lista-dinamicas en el HTML.");
    lista.innerHTML = "";
    (data || []).forEach(dinamica => {
      const boton = document.createElement("button");
      boton.className = "btn-principal";
      boton.textContent = dinamica.title || `Reto ${dinamica.number}`;
      boton.addEventListener("click", () => iniciarReto(dinamica));
      lista.appendChild(boton);
    });
    if (!data || !data.length) lista.textContent = "No hay retos activos todavía.";
    mostrar("pantalla-dinamicas");
  } catch (error) {
    console.error("Error al cargar dinámicas:", error);
    mensaje("No se pudieron cargar los retos: " + error.message);
  }
}

async function iniciarReto(dinamica) {
  dinamicaActual = dinamica;
  preguntaActual = 0;
  puntosTotales = 0;
  respondiendo = false;
  intentoId = null;
  try {
    const { data, error } = await db.from("game_questions").select("*")
      .eq("dynamic_id", dinamica.id).order("number");
    if (error) throw error;
    if (!data || !data.length) return mensaje("Este reto todavía no tiene preguntas.");
    preguntas = data;
    const { data: intento, error: errorIntento } = await db.from("attempts").insert({
      participant_id: participanteId, dynamic_id: dinamica.id,
      status: "in_progress", total_points: 0
    }).select("id").single();
    if (errorIntento) throw errorIntento;
    intentoId = intento.id;
    mostrar("pantalla-juego");
    mostrarPregunta();
  } catch (error) {
    console.error("Error al iniciar reto:", error);
    mensaje("No se pudo iniciar el reto: " + error.message);
  }
}

function mostrarPregunta() {
  clearInterval(temporizador);
  temporizador = null;
  respondiendo = false;
  if (preguntaActual >= preguntas.length) return finalizarReto();

  const pregunta = preguntas[preguntaActual];
  segundos = pregunta.time_limit_seconds || 20;
  inicioPregunta = Date.now();
  $("numero-pregunta").textContent = `Pregunta ${preguntaActual + 1} de ${preguntas.length}`;
  $("cronometro").textContent = segundos;
  $("puntos").textContent = `${puntosTotales} puntos`;
  $("enunciado-pregunta").textContent = pregunta.prompt;
  $("mensaje-respuesta").textContent = "";
  $("barra-progreso").style.width = `${(preguntaActual / preguntas.length) * 100}%`;

  const opciones = $("opciones-respuesta");
  opciones.innerHTML = "";
  let respuestas = pregunta.options || [];
  if (typeof respuestas === "string") {
    try { respuestas = JSON.parse(respuestas); }
    catch { respuestas = respuestas.split(","); }
  }
  if (!Array.isArray(respuestas)) respuestas = [];
  respuestas.forEach(opcion => {
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
  if (respondiendo || temporizador === null) return;
  respondiendo = true;
  clearInterval(temporizador);
  temporizador = null;
  const pregunta = preguntas[preguntaActual];
  const tiempoMs = Math.min(Date.now() - inicioPregunta, 20000);
  $("opciones-respuesta").querySelectorAll("button").forEach(b => b.disabled = true);

  try {
    const { data, error } = await db.rpc("submit_game_answer", {
      p_attempt_id: intentoId,
      p_question_id: pregunta.id,
      p_answer: respuesta === null ? "" : String(respuesta),
      p_response_time_ms: tiempoMs
    });
    if (error) throw error;
    const resultado = data || {};
    const puntosGanados = Number(resultado.points_awarded || 0);
    puntosTotales = Number(resultado.total_points ?? (puntosTotales + puntosGanados));
    $("puntos").textContent = `${puntosTotales} puntos`;
    $("mensaje-respuesta").textContent = resultado.is_correct
      ? `¡Correcto! +${puntosGanados} puntos` : "Respuesta incorrecta.";
    preguntaActual++;
    setTimeout(mostrarPregunta, 1200);
  } catch (error) {
    console.error("Error al guardar respuesta:", error);
    mensaje("No se pudo registrar tu respuesta: " + error.message);
    respondiendo = false;
    mostrarPregunta();
  }
}

async function finalizarReto() {
  clearInterval(temporizador);
  temporizador = null;
  try {
    const { error } = await db.from("attempts").update({
      status: "completed", completed_at: new Date().toISOString(),
      total_points: puntosTotales
    }).eq("id", intentoId);
    if (error) throw error;
    $("puntuacion-final").textContent = puntosTotales;
    $("detalle-puntuacion").textContent = "Has terminado todas las preguntas de este reto.";
    $("barra-progreso").style.width = "100%";
    mostrar("pantalla-resultados");
  } catch (error) {
    console.error("Error al finalizar:", error);
    mensaje("No se pudieron guardar los resultados: " + error.message);
  }
}

$("btn-continuar")?.addEventListener("click", () => {
  if (dinamicaActual) cargarDinamicas(dinamicaActual.week_id);
});

// CLASIFICACIÓN
function llenarSelectorSemanasRanking() {
  const selector = $("selector-semana-ranking");
  if (!selector) return;
  const valorAnterior = selector.value;
  selector.innerHTML = "";
  semanasDisponibles.forEach(semana => {
    const opcion = document.createElement("option");
    opcion.value = semana.id;
    opcion.textContent = semana.title || `Semana ${semana.id}`;
    selector.appendChild(opcion);
  });
  if (valorAnterior && semanasDisponibles.some(s => String(s.id) === valorAnterior)) {
    selector.value = valorAnterior;
  }
}

function abrirClasificacion(origen) {
  pantallaAnteriorClasificacion = origen || "pantalla-semanas";
  llenarSelectorSemanasRanking();
  mostrar("pantalla-clasificacion");
  cargarClasificacion();
}
async function cargarClasificacion() {
  await Promise.all([cargarRankingSemanal(), cargarRankingAcumulado()]);
}
function agregarCelda(fila, contenido) {
  const celda = document.createElement("td");
  celda.textContent = contenido;
  fila.appendChild(celda);
}

async function cargarRankingSemanal() {
  const cuerpo = $("ranking-semanal");
  const selector = $("selector-semana-ranking");
  if (!cuerpo || !selector) return;
  cuerpo.innerHTML = '<tr><td colspan="3">Cargando clasificación...</td></tr>';
  try {
    if (!selector.value) {
      cuerpo.innerHTML = '<tr><td colspan="3">Selecciona una semana.</td></tr>';
      return;
    }
    const { data, error } = await db.from("leaderboard")
      .select("participant_id, display_name, weekly_points")
      .eq("week_id", selector.value).order("weekly_points", { ascending: false });
    if (error) throw error;
    cuerpo.innerHTML = "";
    if (!data || !data.length) {
      cuerpo.innerHTML = '<tr><td colspan="3">Aún no hay participantes con puntos en esta semana.</td></tr>';
      return;
    }
    data.forEach((persona, i) => {
      const fila = document.createElement("tr");
      agregarCelda(fila, i + 1);
      agregarCelda(fila, persona.display_name || "Participante");
      agregarCelda(fila, Number(persona.weekly_points || 0).toLocaleString("es-CO"));
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error("Error en ranking semanal:", error);
    cuerpo.innerHTML = '<tr><td colspan="3">No se pudo cargar la clasificación semanal.</td></tr>';
  }
}

async function cargarRankingAcumulado() {
  const cuerpo = $("ranking-acumulado");
  if (!cuerpo) return;
  cuerpo.innerHTML = '<tr><td colspan="3">Cargando clasificación...</td></tr>';
  try {
    const { data, error } = await db.from("leaderboard")
      .select("participant_id, display_name, cumulative_points")
      .order("cumulative_points", { ascending: false });
    if (error) throw error;

    const unicos = new Map();
    (data || []).forEach(persona => {
      const anterior = unicos.get(persona.participant_id);
      if (!anterior || Number(persona.cumulative_points || 0) > Number(anterior.cumulative_points || 0)) {
        unicos.set(persona.participant_id, persona);
      }
    });
    const ordenados = Array.from(unicos.values())
      .sort((a, b) => Number(b.cumulative_points || 0) - Number(a.cumulative_points || 0));

    cuerpo.innerHTML = "";
    if (!ordenados.length) {
      cuerpo.innerHTML = '<tr><td colspan="3">Aún no hay puntuaciones acumuladas.</td></tr>';
      return;
    }
    ordenados.forEach((persona, i) => {
      const fila = document.createElement("tr");
      agregarCelda(fila, i + 1);
      agregarCelda(fila, persona.display_name || "Participante");
      agregarCelda(fila, Number(persona.cumulative_points || 0).toLocaleString("es-CO"));
      cuerpo.appendChild(fila);
    });
  } catch (error) {
    console.error("Error en ranking acumulado:", error);
    cuerpo.innerHTML = '<tr><td colspan="3">No se pudo cargar la clasificación acumulada.</td></tr>';
  }
}

$("btn-ver-clasificacion")?.addEventListener("click", () => abrirClasificacion("pantalla-semanas"));
$("btn-clasificacion-dinamicas")?.addEventListener("click", () => abrirClasificacion("pantalla-dinamicas"));
$("btn-volver-clasificacion")?.addEventListener("click", () => mostrar(pantallaAnteriorClasificacion));
$("selector-semana-ranking")?.addEventListener("change", cargarRankingSemanal);

console.log("RETO CAFETERO conectado a Supabase con clasificación.");
