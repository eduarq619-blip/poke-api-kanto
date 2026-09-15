const fs = require('node:fs');
const path = require('node:path');
const { ApiError } = require('./errors');
const { cargarSemillaKanto } = require('./seed');

const CLAVES_ESTADISTICAS = [
  'ps',
  'ataque',
  'defensa',
  'ataqueEspecial',
  'defensaEspecial',
  'velocidad'
];
const CAMPOS_EDITABLES = ['nombre', 'foto', 'estadisticas'];

function copiar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function esObjeto(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ahora() {
  return new Date().toISOString();
}

function validarNombre(valor) {
  if (typeof valor !== 'string' || valor.trim().length < 2 || valor.trim().length > 50) {
    throw new ApiError(400, '"nombre" debe tener entre 2 y 50 caracteres.');
  }
  return valor.trim().toLowerCase();
}

function validarFoto(valor) {
  if (typeof valor !== 'string' || valor.length > 2_000) {
    throw new ApiError(400, '"foto" debe ser una URL válida.');
  }
  try {
    const url = new URL(valor);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocolo no permitido');
    return url.toString();
  } catch {
    throw new ApiError(400, '"foto" debe ser una URL HTTP o HTTPS válida.');
  }
}

function validarEstadisticas(valor) {
  if (!esObjeto(valor)) {
    throw new ApiError(400, '"estadisticas" debe ser un objeto JSON.');
  }
  const recibidas = Object.keys(valor);
  const desconocidas = recibidas.filter((clave) => !CLAVES_ESTADISTICAS.includes(clave));
  const faltantes = CLAVES_ESTADISTICAS.filter((clave) => !(clave in valor));
  if (desconocidas.length || faltantes.length) {
    throw new ApiError(400, 'Las estadísticas deben contener exactamente ps, ataque, defensa, ataqueEspecial, defensaEspecial y velocidad.', {
      faltantes,
      desconocidas
    });
  }
  const estadisticas = {};
  for (const clave of CLAVES_ESTADISTICAS) {
    const numero = valor[clave];
    if (!Number.isInteger(numero) || numero < 1 || numero > 255) {
      throw new ApiError(400, `"estadisticas.${clave}" debe ser un entero entre 1 y 255.`);
    }
    estadisticas[clave] = numero;
  }
  return estadisticas;
}

function validarCampos(cuerpo, esCompleta) {
  if (!esObjeto(cuerpo)) throw new ApiError(400, 'El cuerpo debe ser un objeto JSON.');
  const desconocidos = Object.keys(cuerpo).filter((campo) => !CAMPOS_EDITABLES.includes(campo));
  if (desconocidos.length) {
    throw new ApiError(400, 'El cuerpo contiene campos no editables.', { desconocidos });
  }
  if (esCompleta) {
    const faltantes = CAMPOS_EDITABLES.filter((campo) => !(campo in cuerpo));
    if (faltantes.length) throw new ApiError(400, 'Faltan campos obligatorios.', { faltantes });
  } else if (!Object.keys(cuerpo).length) {
    throw new ApiError(400, 'Debe enviar al menos un campo para actualizar.');
  }
}

class PokemonStore {
  constructor({ archivo = path.resolve(process.cwd(), 'data', 'pokemon.json') } = {}) {
    this.archivo = archivo;
    this.pokemon = this.cargar();
  }

  cargar() {
    if (fs.existsSync(this.archivo)) {
      try {
        const datos = JSON.parse(fs.readFileSync(this.archivo, 'utf8'));
        if (!Array.isArray(datos)) throw new Error('la raíz no es un arreglo');
        return datos;
      } catch (error) {
        throw new ApiError(500, 'No se pudo leer la base de datos local.', { causa: error.message });
      }
    }
    const fecha = ahora();
    const semilla = cargarSemillaKanto().map((pokemon) => ({
      ...pokemon,
      creadoEn: fecha,
      actualizadoEn: fecha
    }));
    this.pokemon = semilla;
    this.guardar();
    return semilla;
  }

  guardar() {
    fs.mkdirSync(path.dirname(this.archivo), { recursive: true });
    const temporal = `${this.archivo}.tmp`;
    fs.writeFileSync(temporal, JSON.stringify(this.pokemon, null, 2), 'utf8');
    fs.renameSync(temporal, this.archivo);
  }

  listar({ limite = 20, desplazamiento = 0, nombre = '' } = {}) {
    const termino = nombre.trim().toLowerCase();
    const filtrados = termino
      ? this.pokemon.filter((pokemon) => pokemon.nombre.includes(termino))
      : this.pokemon;
    return {
      total: filtrados.length,
      limite,
      desplazamiento,
      datos: copiar(filtrados.slice(desplazamiento, desplazamiento + limite))
    };
  }

  obtener(id) {
    const pokemon = this.pokemon.find((item) => item.id === id);
    if (!pokemon) throw new ApiError(404, `No existe un Pokémon con id ${id}.`);
    return copiar(pokemon);
  }

  verificarNombreDisponible(nombre, idActual) {
    const existe = this.pokemon.some((pokemon) => pokemon.id !== idActual && pokemon.nombre === nombre);
    if (existe) throw new ApiError(409, 'Ya existe un Pokémon con ese nombre.');
  }

  crear(cuerpo) {
    validarCampos(cuerpo, true);
    const nombre = validarNombre(cuerpo.nombre);
    this.verificarNombreDisponible(nombre);
    const nuevo = {
      id: Math.max(0, ...this.pokemon.map((pokemon) => pokemon.id)) + 1,
      nombre,
      foto: validarFoto(cuerpo.foto),
      estadisticas: validarEstadisticas(cuerpo.estadisticas),
      creadoEn: ahora(),
      actualizadoEn: ahora()
    };
    this.pokemon.push(nuevo);
    this.guardar();
    return copiar(nuevo);
  }

  actualizar(id, cuerpo, esCompleta) {
    const indice = this.pokemon.findIndex((pokemon) => pokemon.id === id);
    if (indice === -1) throw new ApiError(404, `No existe un Pokémon con id ${id}.`);
    validarCampos(cuerpo, esCompleta);
    const actual = this.pokemon[indice];
    const cambios = {};
    if (esCompleta || 'nombre' in cuerpo) cambios.nombre = validarNombre(cuerpo.nombre);
    if (esCompleta || 'foto' in cuerpo) cambios.foto = validarFoto(cuerpo.foto);
    if (esCompleta || 'estadisticas' in cuerpo) {
      const estadisticas = esCompleta
        ? cuerpo.estadisticas
        : { ...actual.estadisticas, ...cuerpo.estadisticas };
      cambios.estadisticas = validarEstadisticas(estadisticas);
    }
    if (cambios.nombre) this.verificarNombreDisponible(cambios.nombre, id);
    const actualizado = { ...actual, ...cambios, actualizadoEn: ahora() };
    this.pokemon[indice] = actualizado;
    this.guardar();
    return copiar(actualizado);
  }

  eliminar(id) {
    const indice = this.pokemon.findIndex((pokemon) => pokemon.id === id);
    if (indice === -1) throw new ApiError(404, `No existe un Pokémon con id ${id}.`);
    const [eliminado] = this.pokemon.splice(indice, 1);
    this.guardar();
    return copiar(eliminado);
  }
}

module.exports = { PokemonStore };
