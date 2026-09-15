const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { crearServidor } = require('../src/server');

async function iniciarApi() {
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'poke-api-'));
  const servidor = crearServidor({ archivoDatos: path.join(directorio, 'pokemon.json') });
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const { port } = servidor.address();
  return {
    url: `http://127.0.0.1:${port}`,
    cerrar: () => new Promise((resolver) => servidor.close(resolver))
  };
}

test('expone los 151 Pokémon de Kanto y permite filtrarlos', async (t) => {
  const api = await iniciarApi();
  t.after(api.cerrar);
  const respuesta = await fetch(`${api.url}/api/v1/pokemon?limite=3&nombre=saur`);
  const cuerpo = await respuesta.json();
  assert.equal(respuesta.status, 200);
  assert.equal(cuerpo.total, 3);
  assert.deepEqual(cuerpo.datos.map((pokemon) => pokemon.nombre), ['bulbasaur', 'ivysaur', 'venusaur']);
  assert.equal(cuerpo.datos[0].estadisticas.ps, 45);
});

test('realiza el ciclo CRUD en JSON', async (t) => {
  const api = await iniciarApi();
  t.after(api.cerrar);
  const nuevo = {
    nombre: 'pikachu-prueba',
    foto: 'https://example.test/pikachu.png',
    estadisticas: { ps: 50, ataque: 55, defensa: 40, ataqueEspecial: 50, defensaEspecial: 50, velocidad: 90 }
  };
  const creado = await fetch(`${api.url}/api/v1/pokemon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nuevo)
  });
  const pokemon = await creado.json();
  assert.equal(creado.status, 201);
  assert.equal(pokemon.id, 152);

  const parche = await fetch(`${api.url}/api/v1/pokemon/152`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estadisticas: { velocidad: 100 } })
  });
  assert.equal(parche.status, 200);
  assert.equal((await parche.json()).estadisticas.velocidad, 100);

  const eliminado = await fetch(`${api.url}/api/v1/pokemon/152`, { method: 'DELETE' });
  assert.equal(eliminado.status, 204);
  const inexistente = await fetch(`${api.url}/api/v1/pokemon/152`);
  assert.equal(inexistente.status, 404);
});

test('valida contenido JSON y estadísticas obligatorias', async (t) => {
  const api = await iniciarApi();
  t.after(api.cerrar);
  const respuesta = await fetch(`${api.url}/api/v1/pokemon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'incompleto' })
  });
  assert.equal(respuesta.status, 400);
  assert.match((await respuesta.json()).error.mensaje, /Faltan campos/);
});
