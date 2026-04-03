const path = require("path");

const PORT = Number(process.env.PORT || 3000);

module.exports = {
  port: PORT,
  appHost: process.env.APP_HOST || `http://localhost:${PORT}`,
  sessionSecret:
    process.env.SESSION_SECRET || "replace-this-secret-before-submission",
  sessionCookie: "session",
  assets: {
    stylesPath: path.join(__dirname, "..", "public", "style.css"),
    schemaPath: path.join(__dirname, "..", "sql", "schema.sql")
  },
  db: {
    host: process.env.PGHOST || "localhost",
    port: process.env.PGPORT || "5432",
    user: process.env.PGUSER || "postgres",
    database: process.env.PGDATABASE || "alon",
    password: process.env.PGPASSWORD || "130520",
    psqlPath: "/Library/PostgreSQL/18/bin/psql"
  },
  defaults: {
    admin: {
      username: "admin",
      password: "Admin123!"
    },
    user: {
      username: "student",
      password: "User12345!"
    }
  }
};
