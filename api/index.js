const fs = require('fs');
const cfg = require('configuracion');
const ip = require('obtener_ip');
const restify = require('restify');
const _ = require('lodash');
const each = require('each');
const Sensor = require('sensor');
const logger = require('logger');
const ldap = require('ldapjs');
const modelos = require('modelos_microservicio_personas');
const respuestas = require(`${cfg.directorio}/respuestas`);
const spawn = require('child_process').spawn;

const key = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.key`);
const cert = fs.readFileSync(`${cfg.directorio}/${cfg.certificado.ruta}/${cfg.certificado.nombre}.crt`);
const sensor = new Sensor();

global.ocupado = false;

let capturarHuella = (buffer = 1, obtenerImagen = false, numIntentos = 20) => {
  return new Promise((resolver, rechazar) => {
    let intentos = Array(numIntentos).fill(0);
    each((intentos))
    .call((intento, indice, siguiente) => {
      sensor.genImg()
      .then((res) => {
        if(res == '00') {
          logger.verbose('Huella detectada');
          if(obtenerImagen) {
            sensor.upImage(buffer)
            .then((imagen) => {
              sensor.img2Tz(buffer)
              .then((res) => {
                return resolver(imagen);
              })
              .catch((err) => {
                logger.error(err);
                return rechazar(err);
              });
            })
            .catch((err) => {
              logger.error(err);
              return rechazar(err);
            });
          }
          else {
            return resolver(sensor.img2Tz(buffer));
          }
        }
        else {
          setTimeout(() => {
            siguiente();
          }, 500);
        }
      })
      .catch((err) => {
        logger.error(err);
        return rechazar(err);
      });
    })
    .then((err) => {
      if(err) {
        return rechazar(err);
      }
      else {
        return rechazar('No se detectó ninguna huella')
      }
    });
  });
};

let clienteLdap = ldap.createClient({
  url: `${Boolean(cfg.ldap.tls) ? 'ldaps' : 'ldap'}://${cfg.ldap.servidor}:${cfg.ldap.puerto}`,
  tlsOptions: {
    rejectUnauthorized: !Boolean(cfg.ldap.tls)
  },
  timeout: 1000 * 15,
  idleTimeout: 1000 * 3600,
  reconnect: true
});

clienteLdap.on('connect', () => {
  logger.verbose(`Conectado al servidor ${Boolean(cfg.ldap.tls) ? 'ldaps' : 'ldap'}://${cfg.ldap.servidor}:${cfg.ldap.puerto}`);
});

clienteLdap.on('error', (err) => {
  logger.error(err);
});

let buscarUsuarios = () => {
  return new Promise((resolver, rechazar) => {
    clienteLdap.bind(cfg.ldap.usuario, cfg.ldap.clave, (err) => {
      if(err) {
        logger.error(err);
        return rechazar(err);
      }
      else {
        let usuarios = [];

        clienteLdap.search(cfg.ldap.basedn, {
          scope: 'sub',
          filter: `(${cfg.ldap.identificador}=*)`
        }, (err, res) => {
          if(err) {
            logger.error(err);
          }
          else {
            res.on('searchEntry', (usuario) => {
              usuarios.push(usuario.object.uid);
            });
            res.on('error', (err) => {
              logger.error(err);
              return rechazar(err);
            });
            res.on('end', (estado) => {
              logger.info(`Búsqueda finalizada con estado ${estado}`);
              return resolver(usuarios);
            });
          }
        });
      };
    });
  });
};

let sincronizarNombres = () => {
  return new Promise((resolver, rechazar) => {
    if(!global.ocupado) {
      logger.info('Iniciada sincronización con LDAP');
      global.ocupado = true;
      buscarUsuarios()
      .then((usuariosLdap) => {
        each(usuariosLdap)
        .call((usuarioLdap, indice, siguiente) => {
          modelos.Persona.find({
            where: {
              persona: usuarioLdap
            }
          })
          .then((res) => {
            if(res) {
              siguiente();
            }
            else {
              modelos.Persona.create({
                persona: usuarioLdap
              })
              .then((res) => {
                siguiente();
              })
              .catch((err) => {
                logger.error(err);
                siguiente();
              })
            }
          })
          .catch((err) => {
            logger.error(err);
            siguiente();
          })
        })
        .then((err) => {
          if(err) {
            global.ocupado = false;
            return rechazar(err);
          }
          else {
            modelos.Persona.findAll({
              attributes: ['persona']
            })
            .then((usuarios) => {
              each(usuarios)
              .call((usuario, indice, siguiente) => {
                if(usuariosLdap.indexOf(usuario.persona) == -1) {
                  modelos.Persona.destroy({
                    where: {
                      persona: usuario.persona
                    }
                  })
                  .then((res) => {
                    siguiente();
                  })
                  .catch((err) => {
                    logger.error(err.message);
                    siguiente();
                  });
                }
                else {
                  siguiente();
                };
              })
              .then((err) => {
                if(err) {
                  global.ocupado = false;
                  return rechazar(err);
                }
                else {
                  global.ocupado = false;
                  return resolver('Terminada sincronización con LDAP');
                };
              });
            })
            .catch((err) => {
              global.ocupado = false;
              return rechazar(err);
            });
          };
        });
      })
      .catch((err) => {
        global.ocupado = false;
        return rechazar(err);
      });
    }
    else {
      return rechazar('La sincronización aún está en curso');
    }
  });
};

setInterval(() => {
  sincronizarNombres()
  .then((res) => {
    logger.info(res);
  })
  .catch((err) => {
    logger.error(err);
  });
}, cfg.ldap.tiempoSincronizacion);

let app = restify.createServer({
  spdy: {
    key: key,
    cert: cert,
    protocols: ['h2', 'spdy/3.1', 'http/1.1'],
    plain: false,
    'x-forwarded-for': true,
    connection: {
      windowSize: 1024 * 1024,
      autoSpdy31: false
    }
  }
});

app.use((req, res, next) => {
  req.originalUrl = req.url;
  next();
});

app.use((req, res, siguiente) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, Authorization, Access-Control-Allow-Origin');
  res.header('Access-Control-Allow-Methods', 'DELETE, PATCH, GET, HEAD, POST, PUT, OPTIONS, TRACE');
  res.header('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time, Authorization');
  res.header('Access-Control-Max-Age', '1000');
  siguiente();
});

app.on('MethodNotAllowed', (req, res) => {
  if(req.method && req.method.toLowerCase() === 'options') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, PATCH, GET, HEAD, POST, PUT, OPTIONS, TRACE');
    res.setHeader('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time, Authorization');
    res.setHeader('Access-Control-Max-Age', '1000');
    return res.send(204);
  }
  else {
    logger.error(`Método no existente ${req.method} para ${req.url}`)
    return res.send(new restify.MethodNotAllowedError());
  };
});

app.pre(restify.pre.sanitizePath());
app.use(restify.queryParser());
app.use(restify.bodyParser());

app.pre((req, res, next) => {
  let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`[${client}] ${req.method} : ${req.url}`)
  next();
});

app.on('after', (req, res, rout, err) => {
  let client = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  logger.info(`[${client}] ${req.method} ${res.statusCode} - ${req.url}`);
  if(err) {
    logger.error(err);
  };
});

app.on('uncaughtException', (req, res, route, err) => {
  logger.error(err)
});

/**
 * @api {post} /huellas Graba una nueva huella o actualizar una existente en la base de datos
 * @apiVersion 1.0.0
 * @apiGroup Huellas
 * @apiParam {Number} id ID de la persona que se desea grabar sus huellas
 * @apiParamExample {json} Ejemplo
 *    {
 *      "id": 2
 *    }
 * @apiSuccess {Boolean} error Estado de error
 * @apiSuccess {Object} mensaje Mensaje de respuesta
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "error": false,
 *      "mensaje": "Huella de usuario jdoe actualizada"
 *    }
 * @apiError {json} 500 Error interno
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "Conexión perdida con el sensor"
 *    }
 * @apiErrorExample {json} 500 No Autorizado
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "No se detectó ninguna huella"
 *    }
 */

app.post(`/v${cfg.api.version}/huellas`, (req, res) => {
  modelos.Persona.findById(req.body.id)
  .then((persona) => {
    if(persona) {
      return sensor.abrirPuerto(cfg.sensor.puerto)
      .then((ser) => {
        return capturarHuella(1);
      })
      .then((dat) => {
        return new Promise((resolver, rechazar) => {
          setTimeout(() => {
            return resolver(capturarHuella(2, true));
          }, 2500);
        })
      })
      .then((imagen) => {
        return new Promise((resolver, rechazar) => {
          sensor.match()
          .then((coincidencia) => {
            if(parseInt(coincidencia, 16) > 100) {
              return sensor.regModel();
            }
            else {
              return rechazar('Las huellas no coinciden');
            }
          })
          .then((msg) => {
            return sensor.upChar()
          })
          .then((plantilla) => {
            return resolver([plantilla, imagen]);
          })
          .catch((err) => {
            return rechazar(err);
          });
        });
      })
      .then((huella) => {
        return modelos.Huella.upsert({
          id: req.body.id,
          plantilla: huella[0],
          imagen: huella[1]
        });
      })
      .then((dat) => {
        sensor.cerrarPuerto();
        res.send(respuestas.correcto.estado, {
          error: false,
          mensaje: `Huella de usuario ${persona.persona} actualizada`
        });
      })
      .catch((err) => {
        sensor.cerrarPuerto();
        logger.error(JSON.stringify(err, null, 2));
        res.send(respuestas.error.interno.estado, {
          error: true,
          mensaje: err
        });
      });
    }
    else {
      res.send(respuestas.error.datosErroneos.estado, {
        error: true,
        mensaje: respuestas.error.datosErroneos.mensaje
      });
    }
  })
  .catch((err) => {
    logger.error(err);
    res.send(respuestas.error.interno.estado, {
      error: true,
      mensaje: err.message
    });
  });
});

/**
 * @api {get} /huellas/:id Envía la imagen de la huella almacenada en la base de datos
 * @apiVersion 1.0.0
 * @apiGroup Huellas
 * @apiParam {Number} id ID de la persona de la que se desea recuperar la imagen
 * @apiError {json} 500 Error interno
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "Conexión perdida con el sensor"
 *    }
 * @apiErrorExample {json} 500 Error interno
 *    HTTP/2 500
 *    {
 *      "error": true,
 *      "mensaje": "Error interno del servidor"
 *    }
 */

app.get(`/v${cfg.api.version}/huellas/:id`, (req, res) => {
  modelos.Huella.findById(req.params.id)
  .then((huella) => {
    res.send(respuestas.correcto.completado.estado, {
      imagen: huella.imagen
    });
  })
  .catch((err) => {
    logger.error(err);
    res.send(respuestas.error.interno.estado, {
      error: true,
      mensaje: err.message
    });
  });
});

/**
 * @api {head} /huellas/:id Verifica si existe la imagen de una huella en la base de datos
 * @apiVersion 1.0.0
 * @apiGroup Huellas
 * @apiParam {Number} id ID de la persona de la que se desea recuperar la imagen
 * @apiSuccess {json} 200 Exitoso
 * @apiError {json} 404 Huella no existente
 * @apiError {json} 500 Error interno
 */

app.head(`/v${cfg.api.version}/huellas/:id`, (req, res) => {
  modelos.Huella.findById(req.params.id)
  .then((huella) => {
    if(huella != null && huella.imagen) {
      res.send(respuestas.correcto.completado.estado);
    }
    else {
      res.send(respuestas.error.inexistente.estado);
    }
  })
  .catch((err) => {
    logger.error(err);
    res.send(respuestas.error.interno.estado);
  })
});

/**
 * @api {patch} /ldap Sincroniza manualmente los datos de LDAP con los de la base de datos de huellas
 * @apiVersion 1.0.0
 * @apiGroup LDAP
 * @apiSuccess {Boolean} error Estado de error
 * @apiSuccess {Object} mensaje Mensaje de respuesta
 * @apiSuccessExample {json} Success
 *    HTTP/2 200 OK
 *    {
 *      "error": false,
 *      "mensaje": "Terminada sincronización con LDAP"
 *    }
 * @apiError {json} 409 Ocupado
 *    HTTP/2 409
 *    {
 *      "error": true,
 *      "mensaje": "La sincronización aún está en curso"
 *    }
 * @apiErrorExample {json} 409 Ocupado
 *    HTTP/2 409
 *    {
 *      "error": true,
 *      "mensaje": "La sincronización aún está en curso"
 *    }
 */

app.patch(`/v${cfg.api.version}/ldap`, (req, res) => {
  sincronizarNombres()
  .then((msg) => {
    res.send(respuestas.correcto.completado.estado, {
      error: false,
      mensaje: msg
    });
  })
  .catch((err) => {
    res.send(respuestas.error.ocupado.estado, {
      error: true,
      mensaje: err
    });
  });
});

app.listen(cfg.api.puerto, () => {
  logger.info(`Servidor iniciado en https://${ip.obtenerIP()}:${cfg.api.puerto}`);
});
