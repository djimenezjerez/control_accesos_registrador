# Registrador para el sistema de control de accesos mediante sensor biométrico de huella dactilar

## Requisitos

* (Sistema operativo instalado)[https://www.raspberrypi.org/downloads/raspbian/]
* (Entorno de ejecución Node.js)[https://nodejs.org/es/]

## Instalación

* Instalación de los módulos
```sh
npm install -g zoo light-server
npm install
```

* Variables de entorno de ejecución (modificar de acuerdo a los datos pertinentes)
```sh
cp .env.ejemplo .env
vim .env
```

* Instanciar la base de datos y probar conexión
```sh
zoo NODE_ENV=production --zoofile .env node base_datos/index.js
```

* Ejecutar servidor
```sh
zoo NODE_ENV=production --zoofile .env node api/index.js
```

## Documentación

* Generar documentación para las llamadas a la API
```sh
apidoc -e "(node_modules|public)" -i api -o doc/api
```

* Mostrar documentación
```sh
light-server -p 8001 -s doclight-server -p 8001 -s doc
```
