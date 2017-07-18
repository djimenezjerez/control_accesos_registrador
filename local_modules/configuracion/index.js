let configuracion = {
  depuracion: Boolean(Number(process.env.APP_DEPURACION)) || false,
  directorio: process.env.PROY_DIR || '/opt/control_accesos/backend',
  certificado: {
    nombre: process.env.CERT_NOMBRE || 'api_control_accesos',
    ruta: process.env.CERT_DIR || 'certs'
  },
  api: {
    servidor: process.env.API_SERVIDOR || 'localhost',
    puerto: process.env.API_PUERTO || 3000,
    version: process.env.API_VERSION || 1
  },
  sensor: {
    puerto: process.env.SENSOR_PUERTO || '/dev/ttyS0',
    cabecera: process.env.SENSOR_CABECERA || 'ef01',
    direccion: process.env.SENSOR_DIRECCION || 'ffffffff',
    tamanoPaquete: Number(process.env.SENSOR_TAMANO_PAQUETE) || 128,
    velocidad: Number(process.env.SENSOR_VELOCIDAD) || 57600,
    longitudClave: Number(process.env.SENSOR_LONGITUD_CLAVE) || 8
  },
  microservicio: {
    tipo: process.env.BASE_DATOS_TIPO || 'postgres',
    servidor: process.env.BASE_DATOS_SERVIDOR || 'localhost',
    puerto: Number(process.env.BASE_DATOS_PUERTO) || 5432,
    usuario: process.env.BASE_DATOS_USUARIO || 'postgres',
    clave: process.env.BASE_DATOS_CLAVE || '',
    bd: process.env.BASE_DATOS_NOMBRE || 'control_accesos'
  },
  ldap: {
    servidor: process.env.LDAP_SERVIDOR || 'ldap.empresa.com',
    puerto: Number(process.env.LDAP_PUERTO) || 389,
    tls: Boolean(Number(process.env.LDAP_TLS)) || false,
    basedn: process.env.LDAP_BASEDN || 'ou=usuarios,dc=empresa,dc=com',
    identificador: process.env.LDAP_IDENTIFICADOR || 'uid',
    usuario: process.env.LDAP_USUARIO_ADMIN || 'admin',
    clave: process.env.LDAP_CLAVE_ADMIN || 'admin',
    tiempoSincronizacion: process.env.LDAP_TIEMPO_SINCRONIZACION * 60 * 1000 || 5 * 60 * 1000
  }
}

module.exports = configuracion;
