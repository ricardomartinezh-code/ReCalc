import { neon } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;
let hasValidatedConnection = false;

export async function getSql() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL no configurado.");
  }
  if (!sqlClient) {
    sqlClient = neon(connectionString);
  }
  if (!hasValidatedConnection) {
    await sqlClient`SELECT 1`;
    hasValidatedConnection = true;
  }
  return sqlClient;
}
