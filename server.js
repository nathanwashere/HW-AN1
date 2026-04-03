const config = require("./src/config");
const { initDb, ensureAdminExists } = require("./src/db/users");
const { createServer } = require("./src/app");

const server = createServer();

initDb()
  .then(ensureAdminExists)
  .then(() => {
    server.listen(config.port, () => {
      console.log(`Server running on ${config.appHost}`);
      console.log(`Default admin username: ${config.defaults.admin.username}`);
      console.log(`Default admin password: ${config.defaults.admin.password}`);
      console.log(`Default standard username: ${config.defaults.user.username}`);
      console.log(`Default standard password: ${config.defaults.user.password}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start application:", error.message);
    process.exit(1);
  });
