let obtenerIpCliente = (ipCliente) => {
  ipCliente = ipCliente.split(/:/)
  if(ipCliente.length > 1) {
    return ipCliente.pop()
  }
  else {
    return ipCliente
  };
}

let ipCliente = (req) => {
  return obtenerIpCliente(req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket.remoteAddress);
}

module.exports.obtenerIP = () => {
  let interfaces = require('os').networkInterfaces();
  for(let interfaz in interfaces) {
    let iface = interfaces[interfaz];
    for(let i = 0; i < iface.length; i++) {
      let alias = iface[i];
      if(alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        return alias.address;
      };
    };
  };
  return '0.0.0.0';
};

module.exports.ipCliente = ipCliente;

module.exports.obtenerIpCliente = obtenerIpCliente;
