const fs = require('fs');
const moment = require('moment');
const cfg = require('configuracion');
let logger = require('winston');

let formatoFecha = () => {
  return moment().locale('es').format('DD-MM-YYYY - H:mm:ss');
};

if(!fs.existsSync(`${cfg.directorio}/logs`)) {
  fs.mkdirSync(`${cfg.directorio}/logs`);
};

logger.setLevels({
  error: 0,
  warn: 1,
  verbose: 2,
  debug: cfg.depuracion ? 3 : 5,
  silly: 4,
  info: cfg.depuracion ? 5 : 3
});

logger.addColors({
  error: 'red',
  warn:  'yellow',
  info:  'green',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'magenta'
});

logger.remove(logger.transports.Console);

logger.add(logger.transports.Console, {
  json: false,
  colorize: true,
  levelOnly: false,
  timestamp: formatoFecha
});

logger.add(require('winston-daily-rotate-file'), {
  filename: `${cfg.directorio}/logs/.log`,
  datePattern: 'dd-MM-yyyy',
  prepend: true,
  json: false,
  colorize: true,
  levelOnly: false,
  timestamp: formatoFecha
});

logger.stream = {
  write: (mensaje) => {
    logger.verbose(mensaje.slice(0, mensaje.length - 1));
  }
};

module.exports = logger;
