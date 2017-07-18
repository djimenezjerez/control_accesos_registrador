const SerialPort = require('serialport');
const each = require('each');
const cfg = require('configuracion');
const logger = require('logger');

class Sensor {
  constructor(velocidad = 57600, tiempoEspera = 30000, direccion = 'ffffffff', tamanoPaquete = 128, cabecera = 'ef01') {
    this.serial = null;
    this.respuesta = '';
    this.tiempoEspera = tiempoEspera;

    this.tamanos = [];
    this.tamanos.push(32);
    for(let i = 1; i < 4; i++) {
      this.tamanos.push(2 * this.tamanos[i - 1]);
    };

    this.velocidades = [];
    for(let i = 1; i < 13; i++) {
      this.velocidades.push(9600 * i);
    };

    this.cabecera = cabecera;

    this.idComandos = {
      'comando': '01',
      'dato': '02',
      'recibido': '07',
      'final': '08'
    };

    this.comandos = {
      'handshake': '17',
      'setAdder': '15',
      'setSysPara': '0e',
      'readSysPara': '0f',
      'templateNum': '1d',
      'genImg': '01',
      'upImage': '0a',
      'downImage': '0b',
      'img2Tz': '02',
      'regModel': '05',
      'upChar': '08',
      'downChar': '09',
      'store': '06',
      'loadChar': '07',
      'deletChar': '0c',
      'empty': '0d',
      'match': '03',
      'search': '04'
    };

    this.respuestas = {
      '00': 'Proceso ejecutado con exito',
      '01': 'Error recibiendo el paquete',
      '02': 'No se encontro huella en el sensor',
      '03': 'Error al guardar el modelo',
      '06': 'Fallo al generar mapa de caracteres, imagen de huella desordenada',
      '07': 'Fallo al generar mapa de caracteres, imagen de huella con pocos puntos',
      '08': 'Las dos huellas comparadas no coinciden',
      '09': 'No se encontro la huella en los registros',
      '0a': 'Error combinando los mapas de caracteres',
      '0b': 'Direccion ID de pagina fuera de rango',
      '0c': 'Error leyendo la plantilla de la memoria',
      '0d': 'Error subiendo la plantilla a la PC',
      '0e': 'El sensor no puede recibir los datos siguientes',
      '0f': 'Error subiendo la imagen a la PC',
      '10': 'Error al borrar la plantilla',
      '11': 'Error al vaciar los registros',
      '12': 'Error al generar la imagen',
      '13': 'Error al leer los registros',
      '1a': 'Error indefinido',
      '1b': 'Configuracion incorrecta de los registros',
      '1c': 'Numero de pagina de bloc de notas invalida',
      '1d': 'Error en el puerto de comunicacion'
    };

    if(typeof direccion == 'string' && direccion.length == 8 && (parseInt(direccion, 16) >= 0 && parseInt(direccion, 16) <= 4294967295)) {
      this.direccion = direccion;
    }
    else if(typeof direccion == 'number' && direccion >= 0 && direccion <= 4294967295) {
      this.direccion = this._int2hex(direccion, 8);
    }
    else {
      logger.error('Dirección de sensor inválida');
      process.exit(1);
    };

    if(typeof tamanoPaquete == 'number' && this.tamanos.includes(tamanoPaquete)) {
      this.tamanoPaquete = tamanoPaquete;
    }
    else {
      logger.error('Tamaño de paquete inválido')
      process.exit(1);
    };

    if(typeof velocidad == 'number' && this.velocidades.includes(velocidad)) {
      this.velocidad = velocidad;
    }
    else {
      logger.error('Velocidad de transmisión inválida');
      process.exit(1);
    };
  };

  _calcularTamanoPaquete(paquete) {
    if(this._verificarPaqueteValido(paquete)) {
      return this._int2hex((paquete.length / 2) + 2);
    };
  };

  _calcularSumaVerificacion(id, tamano, paquete) {
    if(this._verificarPaqueteValido(id) && this._verificarPaqueteValido(tamano) && this._verificarPaqueteValido(paquete)) {
      let suma = 0;
      for(let i = 0; i < paquete.length; i = i + 2) {
        suma = suma + parseInt(paquete.slice(i, i + 2), 16);
      };
      suma = suma + parseInt(id, 16) + parseInt(tamano, 16);
      if(suma > 65535) {
        return 'ffff'
      }
      else {
        return this._int2hex(suma);
      };
    };
  };

  _armarInstruccion(com, param = '') {
    let paquete = '';
    if(this.comandos.hasOwnProperty(com)) {
      if(typeof param == 'number') {
        var parametro = this._int2hex(param);
      }
      else {
        var parametro = param;
      };
      let comando = this.comandos[com] + parametro;
      let idComando = this.idComandos['comando'];
      let tamanoPaquete = this._calcularTamanoPaquete(comando);
      let sumaVerificacion = this._calcularSumaVerificacion(idComando, tamanoPaquete, comando);
      return this.cabecera + this.direccion + idComando + tamanoPaquete + comando + sumaVerificacion;
    }
    else {
      logger.error('Comando inválido');
      process.exit(1);
      return false;
    };
  };

  armarDato(datos) {
    if(this._verificarPaqueteValido(datos)) {
      if(datos.length != 1024) {
        logger.error('Tamaño de paquete inválido');
        process.exit(1);
        return false;
      }
      else {
        let numPaquetes = (datos.length / 2) / this.tamanoPaquete;
        let huella = [];
        for(let i = 0; i < numPaquetes; i++) {
          let comando = datos.slice((i * 2) * this.tamanoPaquete, ((i + 1) * 2) * this.tamanoPaquete);
          if(i == (numPaquetes - 1)) {
            var idComando = this.idComandos['final'];
          }
          else {
            var idComando = this.idComandos['dato'];
          };
          let tamanoPaquete = this._calcularTamanoPaquete(comando);
          let sumaVerificacion = this._calcularSumaVerificacion(idComando, tamanoPaquete, comando);
          let paquete = this.cabecera + this.direccion + idComando + tamanoPaquete + comando + sumaVerificacion;
          huella.push(paquete);
        };
        return huella;
      };
    }
    else {
      logger.error('Byte de respuesta inválido');
      process.exit(1);
      return false;
    };
  };

  _verificarPaqueteValido(paquete) {
    if(typeof paquete == 'string' && paquete.length % 2 == 0) {
      return true;
    }
    else {
      logger.error('Paquete inválido');
      process.exit(1);
      return false;
    };
  };

  _int2hex(numero, longitud = 4) {
    if(typeof numero == 'number') {
      numero = numero.toString(16);
      while(numero.length < longitud) {
        numero = `0${numero}`;
      };
      return numero;
    }
    else {
      logger.error('El número a convertir debe ser un entero');
      process.exit(1);
      return false;
    };
  };

  _tamanoReal(tamano) {
    return (tamano + ((tamano / this.tamanoPaquete) * 11));
  }

  _desarmarDato(paquete, tamanoFinal) {
    logger.verbose('Extrayendo datos de payload...');
    return new Promise((resolver, rechazar) => {
      if(this._tamanoReal(tamanoFinal) * 2 == paquete.length) {
        let numPaquetes = tamanoFinal / this.tamanoPaquete;
        let tamanoPaquete = paquete.length / numPaquetes;
        let huellas = Array(numPaquetes).fill(0);
        let huella = '';

        each(huellas)
        .call((h, i, siguiente) => {
          let p = paquete.substring(i * tamanoPaquete, (i + 1) * tamanoPaquete);
          huella = huella + p.substring(18 , p.length - 4);
          setTimeout(() => {
            siguiente();
          }, 50);
        })
        .then((err) => {
          if(err) {
            return rechazar(err);
          }
          else {
            logger.verbose(`Terminada extracción de datos`);
            return resolver(huella);
          }
        });
      }
      else {
        return rechazar('Tamaño de paquete inválido');
      };
    });
  };

  _recibirDato(tamanoRespuesta) {
    let intervalo = null;
    let detenerProceso = null;

    return new Promise((resolver, rechazar) => {
      intervalo = setInterval(() => {
        if(this.respuesta.length == (tamanoRespuesta * 2)) {
          clearInterval(intervalo);
          clearTimeout(detenerProceso);
          return resolver(this.respuesta);
        }
        else {
          logger.info(`Esperando fin de paquete, ${this.respuesta.length} bytes recibidos...`);
        }
      }, 1000);

      detenerProceso = setTimeout(() => {
        clearInterval(intervalo);
        this.serial.flush();
        setTimeout(() => {
          return rechazar('Conexión perdida con el sensor');
        }, 1000);
      }, this.tiempoEspera);
    });
  };

  _recibir(tamanoRespuesta = 12) {
    let intervalo = null;
    let detenerProceso = null;

    return new Promise((resolver, rechazar) => {
      setTimeout(() => {
        intervalo = setInterval(() => {
          if(this.respuesta.length >= (tamanoRespuesta * 2)) {
            clearInterval(intervalo);
            clearTimeout(detenerProceso);
            let respuesta = this.respuesta.substring(0, tamanoRespuesta * 2);
            this.respuesta = this.respuesta.substring(tamanoRespuesta * 2);
            return resolver(respuesta);
          }
          else {
            (cfg.depuracion) ? logger.verbose(`Esperando respuesta...`) : '';
          }
        }, 500);
      }, 10);

      detenerProceso = setTimeout(() => {
        clearInterval(intervalo);
        this.serial.flush();
        setTimeout(() => {
          return rechazar('Conexión perdida con el sensor');
        }, 1000);
      }, this.tiempoEspera);
    });
  };

  _enviar(paquete, tamanoRespuesta = 12, posicionRespuesta = 9, bytesRespuesta = [9, 9]) {
    this.respuesta = '';

    return new Promise((resolver, rechazar) => {
      if(this.serial != null) {
        (cfg.depuracion) ? logger.verbose(`Enviando paquete: ${paquete}`) : '';
        this.serial.write(new Buffer(paquete, 'hex'), () => {
          this.serial.drain();
          this._recibir(tamanoRespuesta)
          .then((respuesta) => {
            if(respuesta.substring(posicionRespuesta * 2, (posicionRespuesta * 2) + 2) in this.respuestas) {
              logger.info(this.respuestas[respuesta.substring(posicionRespuesta * 2, (posicionRespuesta * 2) + 2)]);
              (cfg.depuracion) ? logger.verbose(`Paquete recibido: ${respuesta}`) : '';
              return resolver(respuesta.substring(bytesRespuesta[0] * 2, (bytesRespuesta[1] + 1) * 2));
            }
            else {
              return rechazar(`El tipo de paquete no está definido: ${respuesta}`);
            }
          })
          .catch((err) => {
            return rechazar(err)
          });
        });
      }
      else {
        logger.verbose(`No se envió el paquete: ${paquete}`);
        return rechazar('No hay ningun puerto serial abierto');
      };
    });
  };

  abrirPuerto(puertoSerial = '/dev/ttyS0') {
    return new Promise((resolver, rechazar) => {
      this.serial = new SerialPort(puertoSerial, {
        baudRate: this.velocidad,
        bufferSize: 94208
        // bufferSize: 139
      }).on('open', () => {
        this.serial.flush();
        logger.info(`Abierto puerto serial ${puertoSerial} a ${this.velocidad} bps`);
        setTimeout(() => {
          resolver(this.serial);
        }, 1000);
      }).on('error', (err) => {
        logger.error(`Error: ${err.message}`);
        rechazar(this.serial);
      }).on('data', (datos) => {
        this.respuesta = this.respuesta + datos.toString('hex');
      })
    });
  };

  cerrarPuerto() {
    this.serial.close(() => {
      logger.info(`Puerto serial cerrado`);
    });
  };

  handshake() {
    logger.info('Verificando conexión con el sensor');
    return this._enviar(this._armarInstruccion('handshake', '00'));
  };

  setAdder(direccionNueva) {
    let parametro = null;
    if(typeof direccionNueva == 'number' && direccionNueva <= 4294967295) {
      parametro = this._int2hex(direccionNueva, 8);
    }
    else if(typeof direccionNueva == 'string') {
      parametro = direccionNueva
    }
    else {
      return 'Formato incorrecto de dirección';
    };
    if(parametro.length != 8) {
      return 'Tamaño de dirección invalida'
    };
    logger.info(`Cambiando direccion de sensor de ${this.direccion} a ${parametro}`);
    this.direccion = parametro;
    return this._enviar(this._armarInstruccion('setAdder', parametro));
  };

  setSysPara(parametro, opcion) {
    let valido = false;
    switch(parametro) {
      case 4:
        if(opcion >= 1 && opcion <= 12) {
          valido = true;
          logger.info(`Cambiando la velocidad de ${this.velocidad} a ${9600 * opcion} bps`);
        }
        else {
          logger.error(`Velocidad no válida: ${9600 * opcion} bps`);
        };
        break;
      case 5:
        if(opcion >= 1 && opcion <= 5) {
          valido = true;
          logger.info(`Cambiando el nivel de seguridad a nivel ${opcion}`);
        }
        else {
          logger.error(`Nivel de seguridad inválido: ${opcion}`);
        };
        break;
      case 6:
        if(opcion >= 0 && opcion <= 3) {
          valido = true;
          logger.info(`Cambiando el tamaño de paquete a ${Math.pow(2, opcion) * 32} bytes`);
        }
        else {
          logger.error(`Tamaño de paquete inválido: ${Math.pow(2, opcion) * 32}`);
        };
        break;
      default:
        logger.error(`Parámetro inválido ${parametro}`);
    };
    if(valido) {
      return this._enviar(this._armarInstruccion('setSysPara', (this._int2hex(parametro, 2) + this._int2hex(opcion, 2))));
    }
    else {
      return false;
    };
  };

  readSysPara(parametro = 9) {
    logger.info(`Leyendo parametros del sensor`);
    return this._enviar(this._armarInstruccion('readSysPara', ''), 28, 9, [10, 25]);
  };

  templateNum() {
    logger.info('Leyendo numero total de plantillas en el sensor');
    return this._enviar(this._armarInstruccion('templateNum', ''), 14, 9, [10, 11]);
  };

  genImg() {
    logger.info('Coloque su dedo en el sensor');
    return this._enviar(this._armarInstruccion('genImg'));
  };

  upImage() {
    return new Promise((resolver, rechazar) => {
      logger.info('Preparando envío de imagen de caracteres a la PC ...');
      this._enviar(this._armarInstruccion('upImage'))
      .then((res) => {
        let tamanoFinal = 36864;
        this._recibirDato(this._tamanoReal(tamanoFinal))
        .then((res) => {
          this._desarmarDato(res, tamanoFinal)
          .then((huella) => {
            return resolver(huella);
          })
          .catch((err) => {
            return rechazar(err);
          });
        })
        .catch((err) => {
          return rechazar(err);
        });
      })
      .catch((err) => {
        return rechazar(err);
      });
    });
  };

  downImage() {
    logger.info('Enviando imagen al sensor ...');
    return this._enviar(this._armarInstruccion('downImage'));
  };

  img2Tz(buffer = '01') {
    if(typeof buffer == 'number') {
      buffer = this._int2hex(buffer, 2);
    };
    if(buffer != '01' && buffer != '02') {
      logger.error('Buffer inválido')
      return false;
    }
    else {
      logger.info('Generando archivo de caracteres');
      return this._enviar(this._armarInstruccion('img2Tz', buffer));
    };
  };

  regModel() {
    logger.info('Combinar informacion de archivo de caracteres');
    return this._enviar(this._armarInstruccion('regModel'));
  };

  upChar(buffer = '01') {
    return new Promise((resolver, rechazar) => {
      if(typeof buffer == 'number') {
        buffer = this._int2hex(buffer, 2);
      };
      if(buffer != '01' && buffer != '02') {
        logger.error('Buffer inválido')
        return false;
      }
      else {
        logger.info('Preparando envío de archivo de caracteres a la PC ...');
        this._enviar(this._armarInstruccion('upChar', buffer))
        .then((res) => {
          let tamanoFinal = 512;
          this._recibirDato(this._tamanoReal(tamanoFinal))
          .then((res) => {
            this._desarmarDato(res, tamanoFinal)
            .then((huella) => {
              return resolver(huella);
            })
            .catch((err) => {
              return rechazar(err);
            });
          })
          .catch((err) => {
            return rechazar(err);
          });
        })
        .catch((err) => {
          return rechazar(err);
        });
      };
    });
  };

  downChar(buffer = '01') {
    if(typeof buffer == 'number') {
      buffer = this._int2hex(buffer, 2);
    };
    if(buffer != '01' && buffer != '02') {
      logger.error('Buffer inválido')
      return false;
    }
    else {
      logger.info('Enviando archivo de caracteres al sensor ...');
      return this._enviar(this._armarInstruccion('downChar', buffer));
    };
  };

  store(id, buffer = '01') {
    if(typeof buffer == 'number') {
      buffer = this._int2hex(buffer, 2);
    };
    if(buffer != '01' && buffer != '02') {
      logger.error('Buffer inválido')
      return false;
    }
    else {
      if(typeof id == 'number' && id > 1000) {
        logger.error('ID demasiado grande');
        return false;
      }
      else if(typeof id == 'number' && id > 0) {
        id = this._int2hex(id, 4);
        logger.info(`Guardando huella en id ${id}`);
        let parametro = `${buffer}${id}`;
        return this._enviar(this._armarInstruccion('store', parametro));
      };
    };
  };

  loadChar(id, buffer = '01') {
    if(typeof buffer == 'number') {
      buffer = this._int2hex(buffer, 2);
    };
    if(buffer != '01' && buffer != '02') {
      logger.error('Buffer inválido');
      return false;
    }
    else {
      if(typeof id == 'number' && id > 1000) {
        logger.error('ID demasiado grande');
        return false;
      }
      else if(typeof id == 'number' && id > 0) {
        id = this._int2hex(id, 4);
        logger.info(`Cargando el id ${id} en el buffer ${buffer}`);
        let parametro = `${buffer}${id}`;
        return this._enviar(this._armarInstruccion('loadChar', parametro));
      }
      else {
        return false;
      };
    };
  };

  deletChar(id, n = '0001') {
    if(typeof n == 'number') {
      n = this._int2hex(n, 4);
    };
    if(typeof id == 'number' && id > 1000) {
      logger.error('ID demasiado grande');
      return false;
    }
    else if(typeof id == 'number' && id > 0) {
      id = this._int2hex(id, 4);
      logger.info(`Borrando ${n} plantillas desde el id ${id}`);
      let parametro = `${id}${n}`;
      return this._enviar(this._armarInstruccion('deletChar', parametro));
    }
    else {
      return false;
    };
  };

  empty() {
    logger.info('Borrando todas las huellas del sensor');
    return this._enviar(this._armarInstruccion('empty'));
  };

  match() {
    logger.info('Comparacion de huellas entre los dos buffers');
    return this._enviar(this._armarInstruccion('match', ''), 14, 9, [10, 11]);
  };

  search(buffer = '01', inicio = '0000', fin = '03e8') {
    if(typeof buffer == 'number') {
      buffer = this._int2hex(buffer, 2);
    };
    if(buffer != '01' && buffer != '02') {
      logger.error('Buffer inválido');
      return false;
    }
    else {
      if(typeof inicio == 'number' && inicio > 1000) {
        logger.error('ID inicial demasiado grande');
        return false;
      }
      else if(typeof inicio == 'number' && inicio > 0) {
        inicio = this._int2hex(inicio, 4);
      };
      if(typeof fin == 'number' && fin >= 255) {
        logger.error('ID final demasiado grande');
        return false;
      }
      else if(typeof fin == 'number' && fin > 0) {
        fin = this._int2hex(fin, 4);
        logger.info(`Buscando huella desde id ${inicio} hasta ${fin}`);
        let parametro = `${buffer}${inicio}${fin}`;
        return this._enviar(this._armarInstruccion('search', parametro), 16, 9, [10, 13]);
      }
      else {
        return false;
      }
    };
  };
};

module.exports = Sensor;
