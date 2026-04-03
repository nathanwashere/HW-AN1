const fs = require("fs");
const { execFile } = require("child_process");
const config = require("../config");

function runPsql(sql) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PGHOST: config.db.host,
      PGPORT: String(config.db.port),
      PGUSER: config.db.user,
      PGDATABASE: config.db.database,
      PGPASSWORD: config.db.password
    };

    execFile(
      config.db.psqlPath,
      ["-X", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", "\t", "-c", sql],
      { env },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr.trim() || error.message));
          return;
        }

        const rows = stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split("\t"));

        resolve(rows);
      }
    );
  });
}

function loadSchemaSql() {
  return fs.readFileSync(config.assets.schemaPath, "utf8");
}

module.exports = {
  runPsql,
  loadSchemaSql
};
