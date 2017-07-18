const fs = require("fs");
const path = require("path");
const Sequelize = require('sequelize');
const cfg = require('configuracion');
const logger = require('logger');

module.exports = {};

let sequelize = new Sequelize(cfg.microservicio.bd, cfg.microservicio.usuario, cfg.microservicio.clave, {
  host: cfg.microservicio.servidor,
  port: cfg.microservicio.puerto,
  dialect: cfg.microservicio.tipo,
  logging: (cfg.depuracion) ? logger.debug : false,
  reconnect: {
    max_retries: 1,
    onRetry: (intento) => {
      logger.info(`Conexión con base de datos perdida, intentando por ${intento} vez`);
      process.exit(1);
    }
  }
});

sequelize.authenticate()
.then(() => {
  logger.info(`Conectado a base de datos ${cfg.microservicio.bd}`);
})
.catch((error) => {
  logger.error(`No se puede conectar con la base de datos ${cfg.microservicio.bd}`);
  process.exit(1);
});

fs.readdirSync(__dirname)
.filter(function(file) {
  return (file.indexOf(".") !== 0) && (file !== "index.js") && (file !== "package.json");
})
.forEach(function(archivo) {
  logger.debug(`Cargando modelo: ${archivo}`);
  var modelo = sequelize.import(`${__dirname}/${archivo}`);
  var nombre = archivo.substr(0, archivo.lastIndexOf('.'));
  module.exports[nombre]=modelo;
});

Object.keys(module.exports).forEach(function(modelName) {
  if ("associate" in module.exports[modelName]) {
    logger.debug(`Asociando ${modelName}`);
    module.exports[modelName].associate(module.exports);
  }
});

module.exports.sequelize = sequelize;
module.exports.Sequelize = Sequelize;
