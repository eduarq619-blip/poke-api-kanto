# Poké API Kanto

API REST educativa de los 151 Pokémon de la primera generación. Está pensada como base para practicar pruebas de software: funciona localmente, responde exclusivamente en JSON, valida las entradas y conserva los cambios en un archivo local.

## Requisitos y ejecución

Se requiere [Node.js](https://nodejs.org/) 18 o superior. No usa dependencias externas, así que no es necesario ejecutar `npm install`.

```bash
node src/server.js
```

La API quedará disponible en `http://localhost:3000`. También se puede cambiar el puerto:

```bash
PORT=4000 node src/server.js
```

En PowerShell:

```powershell
$env:PORT=4000; node src/server.js
```

Al iniciarse, se genera `data/pokemon.json` a partir de una semilla incluida en el repositorio. Ese archivo contiene los cambios realizados mediante el CRUD y se ignora por Git para que cada ejecución de pruebas pueda partir de datos limpios: al borrarlo se restauran los 151 Pokémon originales.

## Modelo de datos

```json
{
  "id": 25,
  "nombre": "pikachu",
  "foto": "https://.../25.png",
  "estadisticas": {
    "ps": 35,
    "ataque": 55,
    "defensa": 40,
    "ataqueEspecial": 50,
    "defensaEspecial": 50,
    "velocidad": 90
  },
  "creadoEn": "2026-09-15T00:00:00.000Z",
  "actualizadoEn": "2026-09-15T00:00:00.000Z"
}
```

Las estadísticas son los valores base publicados por PokéAPI. Las fotos apuntan al arte oficial de cada Pokémon.

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/salud` | Verifica que el servicio esté activo. |
| `GET` | `/api/v1/pokemon` | Lista Pokémon paginados. |
| `GET` | `/api/v1/pokemon/:id` | Consulta un Pokémon por id. |
| `POST` | `/api/v1/pokemon` | Crea un Pokémon. |
| `PUT` | `/api/v1/pokemon/:id` | Reemplaza nombre, foto y todas las estadísticas. |
| `PATCH` | `/api/v1/pokemon/:id` | Actualiza parcialmente un Pokémon. |
| `DELETE` | `/api/v1/pokemon/:id` | Elimina un Pokémon. |

El listado acepta estos parámetros opcionales:

- `limite`: entre 1 y 151; por defecto 20.
- `desplazamiento`: cantidad de registros que se omiten; por defecto 0.
- `nombre`: texto para filtrar sin distinguir mayúsculas y minúsculas.

Ejemplo: `GET /api/v1/pokemon?nombre=saur&limite=3`

## Ejemplo de creación

```http
POST /api/v1/pokemon
Content-Type: application/json

{
  "nombre": "pikachu-prueba",
  "foto": "https://example.com/pikachu.png",
  "estadisticas": {
    "ps": 35,
    "ataque": 55,
    "defensa": 40,
    "ataqueEspecial": 50,
    "defensaEspecial": 50,
    "velocidad": 90
  }
}
```

Para `POST` y `PUT` los tres campos son obligatorios. Para `PATCH` basta incluir el campo que se va a cambiar; si se envía `estadisticas`, se pueden enviar únicamente las estadísticas que cambian. Las estadísticas deben ser enteros de 1 a 255, `nombre` debe ser único y `foto` debe ser una URL HTTP/HTTPS.

## Respuestas de error

Los errores conservan el formato JSON y un estado HTTP apropiado, por ejemplo:

```json
{
  "error": {
    "estado": 404,
    "mensaje": "No existe un Pokémon con id 999."
  }
}
```

## Pruebas automatizadas

```bash
node --test
```

Las pruebas cubren la carga de los 151 registros, el filtrado, el CRUD y validaciones básicas. No se requieren paquetes adicionales.

## Publicación en GitHub y entrega

```bash
git init
git add .
git commit -m "API REST inicial de Pokémon Kanto"
git branch -M main
git remote add origin https://github.com/USUARIO/poke-api-kanto.git
git push -u origin main
```

Reemplace `USUARIO` por la cuenta u organización del grupo. Antes de comprimir o subir, ejecute `node --test` y compruebe que el proyecto responda en `/salud`.
