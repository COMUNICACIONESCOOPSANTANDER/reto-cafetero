
// ============================================
// RETO CAFETERO
// Registro, inicio de sesión, juego y ranking
// ============================================

const SUPABASE_URL = "https://voqdqsoxlqwplhfjchrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_NgaynrOUy74BRpZF-6x5kw_HkjhehPz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// VARIABLES GENERALES
// ============================================

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
let pantallaAnteriorClasificacion = "pantalla-semanas";
let semanasDisponibles = [];

const $ = id => document.getElementById(id);

// Escuchar eventos sin detener la aplicación
// si algún elemento no existe en el HTML.
function escuchar(id, evento, funcion) {
  const elemento = $(id);
  if (elemento) elemento.addEventListener(evento, funcion);
}

// ============================================
// PANTALLAS Y MENSAJES
// ============================================

function mostrar(pantalla) {
  document.querySelectorAll(".pantalla").forEach(p => {
    p.classList.add("oculto");
  });

  const destino = $(pantalla);

  if (destino) {
    destino.classList.remove("oculto");
  } else {
    console.error("No existe la pantalla:", pantalla);
  }
}

function mensaje(texto) {
  alert(texto);
}

function establecerCarga(formulario, cargando, texto) {
  const boton = formulario.querySelector('button[type="submit"]');

  if (!boton) return;

  if (cargando) {
    boton.disabled = true;
    boton.dataset.textoOriginal = boton.textContent;
    boton.textContent = texto;
  } else {
    boton.disabled = false;
    boton.textContent = boton.dataset.textoOriginal || "ENVIAR";
  }
}

// ============================================
// USUARIO Y AUTENTICACIÓN
// ============================================

function crearCorreoInterno(usuario) {
  return `${usuario.toLowerCase().trim()}@reto-cafetero.com`;
}

function validarUsuario(usuario) {
  return /^[a-z0-9._-]{3,24}$/.test(usuario);
}

async function recuperarParticipante() {
  const { data, error } = await db.rpc("get_my_participant_id");

  if (error) throw error;

  participanteId = data;

  if (!participanteId) {
    throw new Error(
      "La cuenta no tiene un participante asociado. Contacta al administrador."
    );
  }

  await cargarSemanas();
}

// ============================================
// BOTONES DE NAVEGACIÓN
// ============================================

escuchar("btn-comenzar", "click", () => {
  mostrar("pantalla-login");
});

escuchar("btn-ir-registro", "click", () => {
  mostrar("pantalla-registro");
});

escuchar("btn-ir-login", "click", () => {
  mostrar("pantalla-login");
});

// ============================================
// CREAR CUENTA
// ============================================

escuchar("form-registro", "submit", async e => {
  e.preventDefault();

  const formulario = e.target;

  const nombre = $("nombre-completo")?.value.trim() || "";
  const usuario = $("usuario-registro")?.value.trim().toLowerCase() || "";
  const contrasena = $("contrasena-registro")?.value || "";

  if (nombre.length < 3) {
    return mensaje("Escribe tu nombre completo.");
  }

  if (!validarUsuario(usuario)) {
    return mensaje(
      "El usuario debe tener entre 3 y 24 caracteres. Usa letras sin tildes, números, punto, guion o guion bajo."
    );
  }

  if (contrasena.length < 8) {
    return mensaje("La contraseña debe tener mínimo 8 caracteres.");
  }

  establecerCarga(formulario, true, "CREANDO CUENTA...");

  try {
    const correoInterno = crearCorreoInterno(usuario);

    // Crear cuenta de autenticación
    const { data, error } = await db.auth.signUp({
      email: correoInterno,
      password: contrasena,
      options: {
        data: {
          username: usuario,
          display_name: nombre
        }
      }
    });

    if (error) throw error;

    if (!data.session) {
      throw new Error(
        "La cuenta se creó, pero no se inició sesión. Revisa la configuración de confirmación de correo en Supabase."
      );
    }

    // Asociar la cuenta con el participante
    const { data: idParticipante, error: errorRegistro } =
      await db.rpc("register_participant", {
        p_username: usuario,
        p_display_name: nombre
      });

    if (errorRegistro) throw errorRegistro;

    participanteId = idParticipante;

    formulario.reset();

    mensaje("¡Tu cuenta fue creada correctamente!");

    await cargarSemanas();

  } catch (error) {
    console.error("Error al crear cuenta:", error);

    const detalle = (error.message || "").toLowerCase();

    if (
      detalle.includes("already registered") ||
      detalle.includes("already been registered") ||
      detalle.includes("duplicate key") ||
      detalle.includes("unique constraint")
    ) {
      mensaje("Ese nombre de usuario ya está registrado. Elige otro.");
    } else {
      mensaje("No se pudo crear la cuenta: " + error.message);
    }

  } finally {
    establecerCarga(formulario, false);
  }
});

// ============================================
// INICIAR SESIÓN
// ============================================

escuchar("form-login", "submit", async e => {
  e.preventDefault();

  const formulario = e.target;

  const usuario = $("usuario-login")?.value.trim().toLowerCase() || "";
  const contrasena = $("contrasena-login")?.value || "";

  if (!validarUsuario(usuario)) {
    return mensaje("Escribe un nombre de usuario válido.");
  }

  if (!contrasena) {
    return mensaje("Escribe tu contraseña.");
  }

  establecerCarga(formulario, true, "INGRESANDO...");

  try {
    const correoInterno = crearCorreoInterno(usuario);

    const { error } = await db.auth.signInWithPassword({
      email: correoInterno,
      password: contrasena
    });

    if (error) throw error;

    await recuperarParticipante();

    formulario.reset();

  } catch (error) {
    console.error("Error al iniciar sesión:", error);

    const detalle = (error.message || "").toLowerCase();

    if (
      detalle.includes("invalid login credentials") ||
      detalle.includes("invalid email or password")
    ) {
      mensaje("Usuario o contraseña incorrectos.");
    } else {
      mensaje("No se pudo iniciar sesión: " + error.message);
    }

  } finally {
    establecerCarga(formulario, false);
  }
});

// ============================================
// RECUPERAR SESIÓN AL VOLVER A LA APLICACIÓN
// ============================================

async function comprobarSesion() {
  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (data.session) {
      await recuperarParticipante();
    } else {
      mostrar("pantalla-inicio");
    }

  } catch (error) {
    console.error("Error al recuperar sesión:", error);
    mostrar("pantalla-inicio");
  }
}

comprobarSesion();

// ============================================
// CERRAR SESIÓN
// ============================================

escuchar("btn-cerrar-sesion", "click", async () => {
  const confirmar = confirm("¿Quieres cerrar tu sesión?");

  if (!confirmar) return;

  clearInterval(temporizador);
  temporizador = null;

  const { error } = await db.auth.signOut();

  if (error) {
    mensaje("No se pudo cerrar la sesión: " + error.message);
    return;
  }

  participanteId = null;
  intentoId = null;
  dinamicaActual = null;
  preguntas = [];

  mostrar("pantalla-inicio");
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

    semanasDisponibles = data || [];

    const lista = $("lista-semanas");

    if (!lista) return;

    lista.innerHTML = "";

    semanasDisponibles.forEach(semana => {
      const boton = document.createElement("button");

      boton.className = "btn-principal";
      boton.textContent = semana.title || `Semana ${semana.id}`;

      boton.addEventListener("click", () => {
        cargarDinamicas(semana.id);
      });

      lista.appendChild(boton);
    });

    if (!semanasDisponibles.length) {
      lista.textContent = "Todavía no hay semanas disponibles.";
    }

    llenarSelectorSemanasRanking();
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

    if (!lista) return;

    lista.innerHTML = "";

    (data || []).forEach(dinamica => {
      const boton = document.createElement("button");

      boton.className = "btn-principal";
      boton.textContent = dinamica.title || `Reto ${dinamica.number}`;

      boton.addEventListener("click", () => {
        iniciarReto(dinamica);
      });

      lista.appendChild(boton);
    });

    if (!data || !data.length) {
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
  if (!participanteId) {
    return mensaje("Debes iniciar sesión nuevamente.");
  }

  dinamicaActual = dinamica;
  preguntaActual = 0;
  puntosTotales = 0;
  respondiendo = false;
  intentoId = null;

  try {
    const { data, error } = await db
      .from("game_questions")
      .select("*")
      .eq("dynamic_id", dinamica.id)
      .order("number");

    if (error) throw error;

    if (!data || !data.length) {
      return mensaje("Este reto todavía no tiene preguntas.");
    }

    preguntas = data;

    // Crear intento del participante
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
// MOSTRAR PREGUNTAS
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
// REGISTRAR RESPUESTA Y PUNTOS
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

  $("opciones-respuesta")
    .querySelectorAll("button")
    .forEach(boton => {
      boton.disabled = true;
    });

  try {
    const { data, error } = await db.rpc("submit_game_answer", {
      p_attempt_id: intentoId,
      p_question_id: pregunta.id,
      p_answer: respuesta === null ? "" : String(respuesta),
      p_response_time_ms: tiempoMs
    });

    if (error) throw error;

    const resultado = data || {};

    const puntosGanados = Number(
      resultado.points_awarded || 0
    );

    puntosTotales = Number(
      resultado.total_points ?? (puntosTotales + puntosGanados)
    );

    $("puntos").textContent = `${puntosTotales} puntos`;

    $("mensaje-respuesta").textContent = resultado.is_correct
      ? `¡Correcto! +${puntosGanados} puntos`
      : "Respuesta incorrecta.";

    preguntaActual++;

    setTimeout(mostrarPregunta, 1200);

  } catch (error) {
    console.error("Error al guardar respuesta:", error);

    mensaje("No se pudo registrar tu respuesta: " + error.message);

    respondiendo = false;
    mostrarPregunta();
  }
}

// ============================================
// FINALIZAR RETO
// La finalización se valida en Supabase
// ============================================

async function finalizarReto() {
  clearInterval(temporizador);
  temporizador = null;

  try {
    const { data, error } = await db.rpc("finish_game_attempt", {
      p_attempt_id: intentoId
    });

    if (error) throw error;

    // Si la función devuelve los puntos, usar el valor confirmado.
    if (data && typeof data === "object" && data.total_points !== undefined) {
      puntosTotales = Number(data.total_points);
    }

    $("puntuacion-final").textContent =
      puntosTotales.toLocaleString("es-CO");

    $("detalle-puntuacion").textContent =
      "Has terminado todas las preguntas de este reto.";

    $("barra-progreso").style.width = "100%";

    mostrar("pantalla-resultados");

  } catch (error) {
    console.error("Error al finalizar el reto:", error);

    mensaje("No se pudo finalizar el reto: " + error.message);
  }
}

// ============================================
// CONTINUAR DESPUÉS DEL RETO
// ============================================

escuchar("btn-continuar", "click", () => {
  if (dinamicaActual) {
    cargarDinamicas(dinamicaActual.week_id);
  }
});

// ============================================
// CLASIFICACIÓN
// ============================================

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

  if (
    valorAnterior &&
    semanasDisponibles.some(s => String(s.id) === valorAnterior)
  ) {
    selector.value = valorAnterior;
  }
}

function abrirClasificacion(origen) {
  pantallaAnteriorClasificacion =
    origen || "pantalla-semanas";

  llenarSelectorSemanasRanking();

  mostrar("pantalla-clasificacion");

  cargarClasificacion();
}

async function cargarClasificacion() {
  await Promise.all([
    cargarRankingSemanal(),
    cargarRankingAcumulado()
  ]);
}

function agregarCelda(fila, contenido) {
  const celda = document.createElement("td");

  celda.textContent = contenido;

  fila.appendChild(celda);
}

// ============================================
// RANKING SEMANAL
// ============================================

async function cargarRankingSemanal() {
  const cuerpo = $("ranking-semanal");
  const selector = $("selector-semana-ranking");

  if (!cuerpo || !selector) return;

  cuerpo.innerHTML =
    '<tr><td colspan="3">Cargando clasificación...</td></tr>';

  try {
    if (!selector.value) {
      cuerpo.innerHTML =
        '<tr><td colspan="3">Selecciona una semana.</td></tr>';

      return;
    }

    const { data, error } = await db
      .from("leaderboard")
      .select("participant_id, display_name, weekly_points")
      .eq("week_id", selector.value)
      .order("weekly_points", { ascending: false });

    if (error) throw error;

    cuerpo.innerHTML = "";

    if (!data || !data.length) {
      cuerpo.innerHTML =
        '<tr><td colspan="3">Aún no hay participantes con puntos en esta semana.</td></tr>';

      return;
    }

    data.forEach((persona, i) => {
      const fila = document.createElement("tr");

      agregarCelda(fila, i + 1);
      agregarCelda(fila, persona.display_name || "Participante");

      agregarCelda(
        fila,
        Number(persona.weekly_points || 0).toLocaleString("es-CO")
      );

      cuerpo.appendChild(fila);
    });

  } catch (error) {
    console.error("Error en ranking semanal:", error);

    cuerpo.innerHTML =
      '<tr><td colspan="3">No se pudo cargar la clasificación semanal.</td></tr>';
  }
}

// ============================================
// RANKING ACUMULADO
// ============================================

async function cargarRankingAcumulado() {
  const cuerpo = $("ranking-acumulado");

  if (!cuerpo) return;

  cuerpo.innerHTML =
    '<tr><td colspan="3">Cargando clasificación...</td></tr>';

  try {
    const { data, error } = await db
      .from("leaderboard")
      .select("participant_id, display_name, cumulative_points")
      .order("cumulative_points", { ascending: false });

    if (error) throw error;

    // Evitar repetir participantes en el ranking acumulado
    const unicos = new Map();

    (data || []).forEach(persona => {
      const anterior = unicos.get(persona.participant_id);

      if (
        !anterior ||
        Number(persona.cumulative_points || 0) >
        Number(anterior.cumulative_points || 0)
      ) {
        unicos.set(persona.participant_id, persona);
      }
    });

    const ordenados = Array.from(unicos.values()).sort(
      (a, b) =>
        Number(b.cumulative_points || 0) -
        Number(a.cumulative_points || 0)
    );

    cuerpo.innerHTML = "";

    if (!ordenados.length) {
      cuerpo.innerHTML =
        '<tr><td colspan="3">Aún no hay puntuaciones acumuladas.</td></tr>';

      return;
    }

    ordenados.forEach((persona, i) => {
      const fila = document.createElement("tr");

      agregarCelda(fila, i + 1);
      agregarCelda(fila, persona.display_name || "Participante");

      agregarCelda(
        fila,
        Number(persona.cumulative_points || 0).toLocaleString("es-CO")
      );

      cuerpo.appendChild(fila);
    });

  } catch (error) {
    console.error("Error en ranking acumulado:", error);

    cuerpo.innerHTML =
      '<tr><td colspan="3">No se pudo cargar la clasificación acumulada.</td></tr>';
  }
}

// ============================================
// BOTONES DE CLASIFICACIÓN
// ============================================

escuchar("btn-ver-clasificacion", "click", () => {
  abrirClasificacion("pantalla-semanas");
});

escuchar("btn-clasificacion-dinamicas", "click", () => {
  abrirClasificacion("pantalla-dinamicas");
});

escuchar("btn-volver-clasificacion", "click", () => {
  mostrar(pantallaAnteriorClasificacion);
});

escuchar("selector-semana-ranking", "change", () => {
  cargarRankingSemanal();
});

// ============================================
// FIN DEL SISTEMA
// ============================================

console.log("RETO CAFETERO: sistema cargado correctamente.");
