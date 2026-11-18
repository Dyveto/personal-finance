import {
  migrateExcelTransactions,
  getExcelMigrationStatus,
} from "../src/features/transactions/actions/migration-actions";

async function main() {
  console.log("=== INICIANDO MIGRACIÓN DE 149 MOVIMIENTOS ===");
  console.log("Usuario objetivo: calderongoenaga2004@gmail.com\n");

  console.log("1. Verificando estado inicial...");
  const preStatus = await getExcelMigrationStatus("calderongoenaga2004@gmail.com");
  console.log("Estado previo:", JSON.stringify(preStatus, null, 2));

  console.log("\n2. Ejecutando migración...");
  const result = await migrateExcelTransactions("calderongoenaga2004@gmail.com");
  console.log("Resultado de la migración:", JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error("Fallo la migración:", result.error);
    process.exit(1);
  }

  console.log("\n3. Verificando idempotencia (ejecutando segunda vez)...");
  const secondResult = await migrateExcelTransactions("calderongoenaga2004@gmail.com");
  console.log("Resultado segunda corrida (debe indicar 0 insertados, 149 omitidos por duplicado):");
  console.log(JSON.stringify(secondResult, null, 2));

  console.log("\n4. Estado final consolidado...");
  const postStatus = await getExcelMigrationStatus("calderongoenaga2004@gmail.com");
  console.log("Estado post-migración:", JSON.stringify(postStatus, null, 2));

  console.log("\n=== MIGRACIÓN FINALIZADA EXITOSAMENTE ===");
}

main().catch((err) => {
  console.error("Error fatal en migración:", err);
  process.exit(1);
});
