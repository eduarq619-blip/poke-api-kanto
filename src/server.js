const http = require('node:http');
const path = require('node:path');
const { PokemonStore } = require('./pokemon-store');
const { ApiError } = require('./errors');

const LIMITE_CUERPO = 1_000_000;

function responder(respuesta, estado, cuerpo) {
  respuesta.writeHead(estado, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  respuesta.end(JSON.stringify(cuerpo));
}

async function leerJson(solicitud) {
  const tipo = solicitud.headers['content-type'] || '';
  if (!tipo.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'Use el encabezado Content-Type: application/json.');
  }
  let cuerpo = '';
  for await (const fragmento of solicitud) {
    cuerpo += fragmento;
    if (Buffer.byteLength(cuerpo) > LIMITE_CUERPO) {
      throw new ApiError(413, 'El cuerpo supera el límite de 1 MB.');
    }
  }
  try {
    return JSON.parse(cuerpo);
  } catch {
    throw new ApiError(400, 'El cuerpo debe contener JSON válido.');
  }
}

function enteroPositivo(valor, etiqueta) {
  if (!/^\d+$/.test(valor || '')) throw new ApiError(400, `"${etiqueta}" debe ser un entero positivo.`);
  return Number(valor);
}

function parametrosListado(url) {
  const limite = url.searchParams.has('limite') ? enteroPositivo(url.searchParams.get('limite'), 'limite') : 20;
  const desplazamiento = url.searchParams.has('desplazamiento')
    ? enteroPositivo(url.searchParams.get('desplazamiento'), 'desplazamiento')
    : 0;
  if (limite < 1 || limite > 151) throw new ApiError(400, '"limite" debe estar entre 1 y 151.');
  return { limite, desplazamiento, nombre: url.searchParams.get('nombre') || '' };
}

function crearServidor({ archivoDatos } = {}) {
  const store = new PokemonStore({ archivo: archivoDatos });
  return http.createServer(async (solicitud, respuesta) => {
    try {
      if (solicitud.method === 'OPTIONS') {
        respuesta.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        return respuesta.end();
      }

      const url = new URL(solicitud.url, 'http://localhost');
      if (solicitud.method === 'GET' && url.pathname === '/salud') {
        return responder(respuesta, 200, { estado: 'ok' });
      }

      if (url.pathname === '/api/v1/pokemon' || url.pathname === '/api/v1/pokemon/') {
        if (solicitud.method === 'GET') {
          return responder(respuesta, 200, store.listar(parametrosListado(url)));
        }
        if (solicitud.method === 'POST') {
          const creado = store.crear(await leerJson(solicitud));
          return responder(respuesta, 201, creado);
        }
      }

      const coincidencia = url.pathname.match(/^\/api\/v1\/pokemon\/(\d+)\/?$/);
      if (coincidencia) {
        const id = Number(coincidencia[1]);
        if (solicitud.method === 'GET') return responder(respuesta, 200, store.obtener(id));
        if (solicitud.method === 'PUT') return responder(respuesta, 200, store.actualizar(id, await leerJson(solicitud), true));
        if (solicitud.method === 'PATCH') return responder(respuesta, 200, store.actualizar(id, await leerJson(solicitud), false));
        if (solicitud.method === 'DELETE') {
          store.eliminar(id);
          respuesta.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
          return respuesta.end();
        }
      }
      throw new ApiError(404, 'Ruta no encontrada.');
    } catch (error) {
      const estado = error instanceof ApiError ? error.status : 500;
      const mensaje = error instanceof ApiError ? error.message : 'Error interno del servidor.';
      return responder(respuesta, estado, {
        error: { estado, mensaje, ...(error.detalles ? { detalles: error.detalles } : {}) }
      });
    }
  });
}

if (require.main === module) {
  const puerto = Number(process.env.PORT || 3000);
  const archivoDatos = process.env.DATA_FILE || path.resolve(process.cwd(), 'data', 'pokemon.json');
  crearServidor({ archivoDatos }).listen(puerto, () => {
    console.log(`Poké API disponible en http://localhost:${puerto}`);
  });
}

module.exports = { crearServidor };
