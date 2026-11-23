
// =====================================
// RETO CAFETERO - COOPERATIVA DE SANTANDER
// =====================================

const SUPABASE_URL = "https://voqdqsoxlqwplhfjchrz.supabase.co";
const SUPABASE_KEY = "sb_publishable_NgaynrOUy74BRpZF-6x5kw_HkjhehPz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let participanteId = null;
let semanaSeleccionada = null;
let dinamicaSeleccionada = null;

// Elementos
const $ = (id) => document.getElementById(id);

function mostrarPantalla(id) {
  document.querySelectorAll(".pantalla").forEach(p => {
    p.classList.add("oculto");
  });
  $(id).classList.remove("oculto");
}

function mensaje(texto) {
  alert(texto);
}

// Inicio
document.addEventListener("DOMContentLoaded", () => {
  $("btn-comenzar").addEventListener("click", () => {
    mostrarPantalla("pantalla-registro");
  });

  $("form-registro").addEventListener("submit", registrarParticipante);

  $("btn-continuar").addEventListener("click", () => {
    cargarSemanas();
  });

  // El registro actual guarda únicamente el nombre.
  $("documento").required = false;
  $("punto").required = false;
});

// Registro
async function registrarParticipante(e) {
  e.preventDefault();

  const nombre = $("nombre").value.trim();

  if (nombre.length < 3) {
    mensaje("Escribe tu nombre completo.");
    return;
  }

  const boton = e.submitter;
  boton.disabled = true;
  boton.textContent = "REGISTRANDO...";

  try {
    const { data, error } = await db.rpc("register_participant", {
      p_name: nombre
    });

    if (error) throw error;

    participanteId = data;

    mensaje("¡Registro exitoso! Bienvenido al Reto Cafetero.");
    await cargarSemanas();

  } catch (error) {
    console.error(error);
    mensaje("No fue posible registrarte: " + error.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "REGISTRARME";
  }
}

// Semanas
async function cargarSemanas() {
  try {
    const { data, error } = await db
      .from("weeks")
      .select("*")
      .order("id");

    if (error) throw error;

    const contenedor = $("lista-semanas");
    contenedor.innerHTML = "";

    data.filter(s => s.is_active).forEach(semana => {
      const boton = document.createElement("button");
      boton.className = "btn-principal";
      boton.textContent = semana.title || `Semana ${semana.id}`;

      boton.addEventListener("click", () => {
        semanaSeleccionada = semana.id;
        cargarDinamicas();
      });

      contenedor.appendChild(boton);
    });

    if (!contenedor.children.length) {
      contenedor.textContent = "No hay semanas activas todavía.";
    }

    mostrarPantalla("pantalla-semanas");

  } catch (error) {
    console.error(error);
    mensaje("Error al cargar semanas: " + error.message);
  }
}

// Retos
async function cargarDinamicas() {
  try {
    const { data, error } = await db
      .from("dynamics")
      .select("*")
      .eq("week_id", semanaSeleccionada)
      .eq("is_active", true)
      .order("number");

    if (error) throw error;

    const contenedor = $("lista-dinamicas");
    contenedor.innerHTML = "";

    data.forEach(dinamica => {
      const boton = document.createElement("button");
      boton.className = "btn-principal";
      boton.textContent = dinamica.title || `Reto ${dinamica.number}`;

      boton.addEventListener("click", () => {
        dinamicaSeleccionada = dinamica.id;
        cargarPreguntas();
      });

      contenedor.appendChild(boton);
    });

    if (!contenedor.children.length) {
      contenedor.textContent = "No hay retos activos en esta semana.";
    }

    mostrarPantalla("pantalla-dinamicas");

  } catch (error) {
    console.error(error);
    mensaje("Error al cargar retos: " + error.message);
  }
}

// Preguntas: carga de contenido
async function cargarPreguntas() {
  try {
    const { data, error } = await db
      .from("game_questions")
      .select("*")
      .eq("dynamic_id", dinamicaSeleccionada)
      .order("number");

    if (error) throw error;

    if (!data || data.length === 0) {
      mensaje("Este reto todavía no tiene preguntas.");
      return;
    }

    mensaje(
      `¡Reto cargado! Tiene ${data.length} preguntas. ` +
      "El siguiente paso será activar el juego y guardar los puntos."
    );

  } catch (error) {
    console.error(error);
    mensaje("Error al cargar preguntas: " + error.message);
  }
}

// Conexión
async function verificarConexion() {
  const { error } = await db
    .from("weeks")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Error de conexión:", error.message);
  } else {
    console.log("RETO CAFETERO conectado a Supabase.");
  }
}

verificarConexion();
