const logger = require('logger');
const modelos = require('modelos_microservicio_personas');

modelos.sequelize.sync({
  force: true
})
.then(() => {
  logger.info(`Base de datos creada`);
  process.exit(0);
})
.catch((err) => {
  logger.info(`Error al crear la base de datos: ${err}`);
  process.exit(1);
});
