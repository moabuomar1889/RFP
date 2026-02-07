// Prisma v7 Configuration File
// Defines datasource URLs separately from schema.prisma
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env["DIRECT_URL"]!, // Direct connection for migrations (bypasses pooler)
    },
});
