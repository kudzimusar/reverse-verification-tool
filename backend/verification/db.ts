import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const verificationDB = new SQLDatabase("verification", {
  migrations: "./migrations",
});
