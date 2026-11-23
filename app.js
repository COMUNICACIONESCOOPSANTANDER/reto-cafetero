
// ========================================
// RETO CAFETERO - CONEXIÓN SUPABASE
// Cooperativa de Caficultores de Santander
// ========================================

const SUPABASE_URL = "https://voqdqsoxlqwplhfjchrz.supabase.co";

const SUPABASE_KEY = "sb_publishable_NgaynrOUy74BRpZF-6x5kw_HkjhehPz";

// Crear conexión
const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Compartir conexión con el resto de la aplicación
window.db = db;

// Verificar conexión
async function verificarConexion() {
  const { data, error } = await db
    .from("semanas")
    .select("id, titulo")
    .limit(5);

  if (error) {
    console.error("Error de conexión:", error.message);
    return false;
  }

  console.log("¡Supabase conectado correctamente!");
  console.log("Semanas disponibles:", data);

  return true;
}

verificarConexion();

