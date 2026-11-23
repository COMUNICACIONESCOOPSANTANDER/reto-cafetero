
// ============================================
// CLASIFICACIÓN - RETO CAFETERO
// ============================================

// Abrir clasificación
$("btn-ver-clasificacion").addEventListener("click", abrirClasificacion);

$("btn-clasificacion-dinamicas").addEventListener("click", abrirClasificacion);

// Volver a las semanas
$("btn-volver-clasificacion").addEventListener("click", () => {
  mostrar("pantalla-semanas");
});

// Cambiar semana del ranking
$("selector-semana-ranking").addEventListener("change", cargarRankingSemanal);


// Mostrar pantalla y consultar rankings
async function abrirClasificacion() {
  mostrar("pantalla-clasificacion");
  await cargarRankingSemanal();
  await cargarRankingAcumulado();
}


// ============================================
// RANKING SEMANAL
// ============================================

async function cargarRankingSemanal() {
  const semana = $("selector-semana-ranking").value;
  const tabla = $("ranking-semanal");

  tabla.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

  try {
    const { data, error } = await db
      .from("leaderboard")
      .select("participant_id, display_name, week_id, weekly_points")
      .eq("week_id", Number(semana))
      .order("weekly_points", { ascending: false });

    if (error) throw error;

    tabla.innerHTML = "";

    if (!data || data.length === 0) {
      tabla.innerHTML =
        "<tr><td colspan='3'>Todavía no hay participantes con puntos.</td></tr>";
      return;
    }

    data.forEach((persona, indice) => {
      const fila = document.createElement("tr");

      const posicion = document.createElement("td");
      posicion.textContent = indice + 1;

      const nombre = document.createElement("td");
      nombre.textContent = persona.display_name;

      const puntos = document.createElement("td");
      puntos.textContent = Number(persona.weekly_points).toLocaleString("es-CO");

      fila.append(posicion, nombre, puntos);
      tabla.appendChild(fila);
    });

  } catch (error) {
    console.error("Error en ranking semanal:", error);
    tabla.innerHTML =
      "<tr><td colspan='3'>No se pudo cargar el ranking semanal.</td></tr>";
  }
}


// ============================================
// RANKING ACUMULADO
// ============================================

async function cargarRankingAcumulado() {
  const tabla = $("ranking-acumulado");

  tabla.innerHTML = "<tr><td colspan='3'>Cargando...</td></tr>";

  try {
    const { data, error } = await db
      .from("leaderboard")
      .select("participant_id, display_name, cumulative_points")
      .order("cumulative_points", { ascending: false });

    if (error) throw error;

    // Evitar repetir participantes que aparecen en varias semanas
    const participantes = new Map();

    data.forEach(persona => {
      const anterior = participantes.get(persona.participant_id);

      if (
        !anterior ||
        Number(persona.cumulative_points) > Number(anterior.cumulative_points)
      ) {
        participantes.set(persona.participant_id, persona);
      }
    });

    const ranking = Array.from(participantes.values())
      .sort((a, b) =>
        Number(b.cumulative_points) - Number(a.cumulative_points)
      );

    tabla.innerHTML = "";

    if (ranking.length === 0) {
      tabla.innerHTML =
        "<tr><td colspan='3'>Todavía no hay participantes.</td></tr>";
      return;
    }

    ranking.forEach((persona, indice) => {
      const fila = document.createElement("tr");

      const posicion = document.createElement("td");
      posicion.textContent = indice + 1;

      const nombre = document.createElement("td");
      nombre.textContent = persona.display_name;

      const puntos = document.createElement("td");
      puntos.textContent =
        Number(persona.cumulative_points).toLocaleString("es-CO");

      fila.append(posicion, nombre, puntos);
      tabla.appendChild(fila);
    });

  } catch (error) {
    console.error("Error en ranking acumulado:", error);
    tabla.innerHTML =
      "<tr><td colspan='3'>No se pudo cargar el ranking acumulado.</td></tr>";
  }
}

console.log("Clasificación del RETO CAFETERO activada.");
