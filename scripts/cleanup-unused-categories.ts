import { cleanUnusedDefaultCategories } from "../src/features/categories/actions/category-actions";

async function main() {
  const targetEmail = "calderongoenaga2004@gmail.com";
  console.log("=== INICIANDO LIMPIEZA DE CATEGORÍAS PREDETERMINADAS NO UTILIZADAS ===");
  console.log(`Usuario objetivo: ${targetEmail}\n`);

  console.log("Ejecutando cleanUnusedDefaultCategories...");
  const result = await cleanUnusedDefaultCategories(targetEmail);

  if (!result.success) {
    console.error("Fallo la limpieza de categorías:", result.error);
    process.exit(1);
  }

  const { data } = result;
  console.log("\n=== RESULTADO DE LA LIMPIEZA ===");
  console.log(`Usuario: ${data.userEmail} (ID: ${data.userId})`);
  console.log(`Total eliminadas (0 transacciones): ${data.totalDeleted}`);
  console.log(`Total conservadas (en uso / personalizadas): ${data.totalKept}\n`);

  console.log("Categorías eliminadas:");
  for (const cat of data.deletedCategories) {
    console.log(`  - 🗑️ [${cat.category_type.toUpperCase()}] ${cat.name} (is_default: ${cat.is_default})`);
  }

  console.log("\nCategorías conservadas:");
  for (const cat of data.keptCategories) {
    console.log(`  - ✅ [${cat.category_type.toUpperCase()}] ${cat.name}: ${cat.transactionCount} transacciones (is_default: ${cat.is_default})`);
  }

  console.log("\nVerificando idempotencia en segunda ejecución...");
  const secondRun = await cleanUnusedDefaultCategories(targetEmail);
  if (!secondRun.success) {
    console.error("Fallo la segunda verificación:", secondRun.error);
    process.exit(1);
  }

  console.log(`Segunda corrida: ${secondRun.data.totalDeleted} eliminadas, ${secondRun.data.totalKept} conservadas (Idempotente: OK)`);
  console.log("\n=== LIMPIEZA FINALIZADA CON ÉXITO ===");
}

main().catch((err) => {
  console.error("Error fatal en script de limpieza:", err);
  process.exit(1);
});
