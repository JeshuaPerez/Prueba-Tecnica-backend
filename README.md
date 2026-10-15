# Backend de pólizas de importación

API REST construida con **Node.js (ES Modules), Express y PostgreSQL**. La base de datos se llama `polizas`. El diseño separa los datos de cabecera de la póliza y las partidas SAC para representar la relación uno-a-muchos: una póliza puede contener varios ítems.

## 1. Requisitos

- Node.js 20 o superior.
- Docker Desktop con Docker Compose, o PostgreSQL 14+ instalado localmente.
- Un archivo CSV con encabezados compatibles con el esquema definido abajo.

## 2. Levantar PostgreSQL con Docker

1. Descomprime el proyecto y abre una terminal en su carpeta.
2. Copia `.env.example` como `.env`.
3. Si usarás Docker, define una contraseña segura para PostgreSQL. Por ejemplo, en PowerShell:
   ```powershell
   $env:POSTGRES_PASSWORD="una_clave_segura"
   docker compose up -d
   ```
   En Linux/macOS:
   ```bash
   export POSTGRES_PASSWORD='una_clave_segura'
   docker compose up -d
   ```
4. Docker crea la base `polizas` y ejecuta `sql/schema.sql` en la primera inicialización del volumen.

La URL de conexión en `.env` debe coincidir con tus credenciales:
```env
DATABASE_URL=postgres://postgres:una_clave_segura@localhost:5432/polizas
DB_SSL=false
PORT=3000
```

> Si el volumen de Docker ya existía, PostgreSQL no vuelve a ejecutar automáticamente los scripts de inicialización. Para aplicar/verificar el esquema, ejecuta `npm run db:init`. Para borrar la base de datos persistida y recrearla desde cero, `docker compose down -v` elimina permanentemente los datos del volumen.

## 3. Instalar y ejecutar el backend

```bash
npm install
cp .env.example .env
# Edita DATABASE_URL y las demás variables de .env
npm run db:init
npm run dev
```

En Windows PowerShell, si `cp` no funciona:
```powershell
Copy-Item .env.example .env
```

API: `http://localhost:3000/api/v1`  
Comprobación: `GET http://localhost:3000/health`

Para iniciar sin recarga automática: `npm start`.

## 4. Importar el CSV automáticamente

Coloca el CSV en `data/importaciones.csv` (o configura `CSV_PATH` en `.env`). El importador espera estos encabezados exactos:

```csv
correlativo,fecha_declaracion,aduana,tipo_regimen,tipo_cambio_dolar,sac,descripcion,pais,tipo_unidad_medida,cantidad_fraccion,tasa_dai,valor_dai,valor_cif_uds,tasa_cif_cantidad_fraccion
32642260,2023-08-30,Aduana Integrada Agua Caliente,ID Importacion Definitiva,7.8715,8504400000,DISPOSITIVO SOLAR 03-62-1000-2-41-AT,CHINA,PIEZAS,1,0,0,670.78,670.780029296875
```

Ejecuta:
```bash
npm run csv:import
```

- Cada fila del CSV representa una partida/ítem de una póliza.
- Las filas con el mismo `correlativo` se asocian a la misma cabecera.
- El importador valida campos obligatorios, fecha real `YYYY-MM-DD`, números no negativos, correlativo/SAC numéricos como texto y unidades permitidas.
- La operación corre en una transacción: si encuentra una fila inválida, revierte toda la importación para evitar una carga parcial.
- Si vuelves a importar el mismo archivo, no inserta de nuevo un ítem idéntico. Si el mismo correlativo tiene datos de cabecera diferentes, cancela la carga.
- El CSV se lee en streaming; no se carga entero en memoria.
- El importador termina con error (exit 1) y mensaje claro si falta el archivo, si el encabezado no tiene todas las columnas o si el archivo no trae filas de datos.
- En el repositorio se incluyen `data/importaciones.csv` (datos de ejemplo) y `data/importaciones-con-error.csv` (para demostrar el `ROLLBACK`), de modo que un clon limpio puede importar de inmediato.

**Importante:** los encabezados deben corresponder exactamente a los nombres indicados. Si tu exportación usa otras grafías (por ejemplo `tipo_unidad_medida` con acentos o encabezados con espacios), normalízalos antes de importar o adapta el importador. Guarda el CSV en UTF-8.

## 5. Endpoints

Todas las rutas de negocio están versionadas bajo `/api/v1`.

### 1) Listar pólizas con paginación
`GET /api/v1/importaciones?page=1&limit=20`

- `page`: entero desde 1 (predeterminado 1).
- `limit`: entero entre 1 y 100 (predeterminado 20).
- Respuesta: `data` con pólizas e ítems, más metadatos `pagination`.

### 2) Obtener una póliza por correlativo
`GET /api/v1/importaciones/32642260`

`correlativo` se trata como cadena numérica, no como entero, para conservar ceros a la izquierda. Devuelve cabecera e ítems; 404 si no existe.

### 3) Buscar pólizas que contienen un SAC
`GET /api/v1/sac/8504400000?page=1&limit=20`

Se usa `/sac/:sac` en lugar de `/importaciones/:sac`, porque Express no puede distinguir dos rutas GET con exactamente el mismo patrón `/importaciones/:param`. Si ambas se declararan como se solicitaron, una ocultaría a la otra. La ruta elegida mantiene inequívoco el contrato. Devuelve las pólizas donde existe ese SAC.

### 4) Estadísticas por país
`GET /api/v1/estadisticas/por-pais`

Devuelve número de pólizas, número de ítems, suma de cantidad, CIF total y DAI total agrupados por país de procedencia.

### 5) Estadísticas por aduana
`GET /api/v1/estadisticas/por-aduana`

Devuelve número de pólizas, número de ítems, CIF total y DAI total agrupados por aduana.

### Health check
`GET /health`

## 6. Modelo relacional

### `importaciones` (cabecera)
- `id`: PK interna.
- `correlativo`: identificador externo, `VARCHAR` con restricción de unicidad; preserva ceros.
- `fecha_declaracion`: `DATE`.
- `aduana`, `tipo_regimen`: texto obligatorio.
- `tipo_cambio_dolar`: `NUMERIC(14,6)`, mayor que cero.

### `items_importacion` (detalle)
- `id`: PK interna.
- `importacion_id`: FK a `importaciones`, con borrado en cascada.
- `sac`: `VARCHAR`, preserva ceros iniciales.
- `descripcion`, `pais`: texto obligatorio.
- `tipo_unidad_medida`: restringida a `PIEZAS`, `KG`, `M2`, `M`, `M3`, `L`, `PARES`, `JUEGOS` (el importador convierte `KILOGRAMOS`, `METROS CUADRADOS`, etc.).
- Cantidad, tasas y valores: `NUMERIC` con decimales y restricciones no negativas.

### Decisiones de negocio

- Aunque `correlativo` y `sac` se describan como numéricos, se almacenan como texto porque son identificadores/códigos y no se calculan. Así no se pierden ceros a la izquierda ni se altera el formato.
- Se separa cabecera y detalle porque un correlativo puede aparecer en múltiples filas CSV con diferentes partidas SAC.
- Se permite cantidad cero y valores monetarios/tasas cero; si el negocio exige valores estrictamente positivos o rangos máximos de tasas, se deben confirmar con las reglas oficiales antes de endurecer las restricciones.
- `tasa_dai` se valida como número no negativo, pero no se impone un máximo porcentual porque no se proporcionó el convenio de representación (porcentaje `12.5` frente a fracción `0.125`).
- Los importes usan `NUMERIC` de PostgreSQL para no usar coma flotante binaria como tipo de almacenamiento.
- El importador es idempotente para filas de detalle idénticas; dos partidas iguales legítimas en el CSV se tratarán como duplicadas. Si el negocio permite partidas idénticas separadas, conviene añadir una columna `numero_linea` y usarla como identidad de la partida.

## 7. Arquitectura por capas

- `routes/`: define las rutas y enlaza validaciones con controladores.
- `controllers/`: adapta HTTP a llamadas del servicio y devuelve JSON.
- `services/`: aplica reglas de negocio y errores de dominio (por ejemplo, póliza inexistente).
- `repositories/`: concentra consultas SQL parametrizadas a PostgreSQL.
- `validators/` y `middlewares/`: validan parámetros, paginación y transforman errores.
- `config/`: configuración de entorno y pool de PostgreSQL.
- `sql/`: esquema relacional, restricciones, índices y trigger.
- `scripts/`: inicialización del esquema e importación transaccional de CSV.

## 8. Formato de errores

```json
{
  "error": {
    "code": "POLIZA_NOT_FOUND",
    "message": "No existe la póliza con correlativo 123."
  }
}
```

Códigos frecuentes:
- `400`: parámetros, fecha, formato o restricciones de datos inválidos.
- `404`: ruta o póliza inexistente.
- `409`: conflicto de unicidad.
- `500`: error inesperado del servidor.

## 9. Pruebas rápidas

```bash
curl "http://localhost:3000/health"
curl "http://localhost:3000/api/v1/importaciones?page=1&limit=20"
curl "http://localhost:3000/api/v1/importaciones/32642260"
curl "http://localhost:3000/api/v1/sac/8504400000"
curl "http://localhost:3000/api/v1/estadisticas/por-pais"
curl "http://localhost:3000/api/v1/estadisticas/por-aduana"
```

## 10. Seguridad y producción

- No publiques `.env` ni guardes credenciales reales en Git.
- Ajusta `CORS_ORIGIN` al dominio real.
- Para conexiones remotas, activa TLS (`DB_SSL=true`) y configura certificados según el proveedor.
- Añade autenticación/autorización si la API no debe ser pública.
- Antes de producción, añade pruebas automatizadas, límites de tasa, logging estructurado y monitoreo.

## 11. Demostración rápida

- `polizas.insomnia.json`: colección para importar en Insomnia (Application → Import) con los 5 endpoints y casos de error (400/404).
- `sql/demo-queries.sql`: consultas para mostrar en pgAdmin/psql que los datos y la relación 1-N están en PostgreSQL.
- `data/importaciones-con-error.csv`: CSV con una fecha inválida (`2023-02-30`) para demostrar el `ROLLBACK`:
  ```powershell
  $env:CSV_PATH="./data/importaciones-con-error.csv"; npm run csv:import; Remove-Item Env:CSV_PATH
  ```

## 12. Mejoras propuestas

**Modularización**
- Separar por módulo de dominio en vez de por tipo de archivo: `src/modules/importaciones/` y `src/modules/estadisticas/`, cada uno con sus `routes`, `controller`, `service` y `repository`. Hoy las rutas de estadísticas viven en `importaciones.routes.js`.
- Extraer el armado de `pagination` (repetido en `list` y `getBySac`) a una función utilitaria.
- Reutilizar el pool y las validaciones de `src/` dentro de `scripts/import-csv.js`, que hoy crea su propio pool.
- Unificar el `json_build_object` de ítems (repetido 3 veces en el repositorio) en una sola constante.

**Base de datos**
- Migraciones versionadas (node-pg-migrate o Knex) en lugar de un único `schema.sql`.
- Columna `numero_linea` para permitir partidas idénticas legítimas dentro de una póliza.

**Calidad**
- Pruebas automatizadas: unitarias de validadores y servicios, de integración de endpoints con Jest + Supertest contra una BD de prueba.
- Validación con un esquema (Zod/Joi) en lugar de validaciones manuales.
- Importador en lotes (`INSERT` multi-fila o `COPY`) para CSV grandes; hoy hace 2-3 consultas por fila.
- Modo reporte en el importador: cargar las filas válidas y generar un archivo con las rechazadas (hoy una fila inválida cancela toda la carga).

**Producción**
- Autenticación (JWT/API key), rate limiting, logging estructurado (pino) y documentación OpenAPI/Swagger.
