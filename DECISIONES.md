# DECISIONES.md — Bitácora de decisiones (y cómo usé la IA)

> Este archivo registra las decisiones técnicas del proyecto en formato de conversación:
> qué pregunté, qué sugirió la IA y **qué decidí yo y por qué**. Usé la IA como apoyo para
> contrastar opciones y revisar código; las decisiones finales y las pruebas las hice yo.

---

## 1. ¿Una tabla o dos?

**Yo:** El CSV trae una fila por partida. Si un mismo `correlativo` aparece varias veces, ¿lo guardo todo en una tabla?

**IA:** Con una sola tabla repetirías fecha, aduana, régimen y tipo de cambio en cada fila. Sugiere separar cabecera (`importaciones`) y detalle (`items_importacion`) con una FK.

**Decisión:** Dos tablas, relación uno-a-muchos. Una póliza tiene varias partidas SAC. Así los datos de la póliza no se duplican y no pueden quedar inconsistentes entre filas.

---

## 2. ¿`correlativo` y `sac` como número o como texto?

**Yo:** Son "numéricos". ¿Los guardo como `INTEGER`/`BIGINT`?

**IA:** Son *identificadores*, no cantidades: nunca se suman ni se promedian. Como número se pierden los ceros a la izquierda (`0123` → `123`).

**Decisión:** `VARCHAR`, y en la API valido con regex que sean solo dígitos. Regla que me quedo: *si no hago matemáticas con él, no es un número, es un código.*

---

## 3. ¿`FLOAT` o `NUMERIC` para el dinero?

**IA:** `FLOAT` es binario y no representa exacto valores como 0.1, así que al sumar miles de valores CIF aparecen centavos fantasma.

**Decisión:** `NUMERIC(p,s)` en PostgreSQL. Consecuencia que acepté: el driver `pg` devuelve los `NUMERIC` como *string* en JSON (`"670.780000"`), justamente para no perder precisión en JavaScript.

---

## 4. ¿Cómo validar y dónde?

**Decisión: validación en dos capas.**
- **En la API** (middlewares/validators): paginación (`page >= 1`, `1 <= limit <= 100`) y formato de `correlativo`/`sac`. Respondo 400 con un mensaje claro antes de tocar la BD.
- **En la BD** (`CHECK`, `NOT NULL`, `UNIQUE`, `FK`): es la última línea de defensa. Aunque alguien inserte por fuera de la API, la BD no acepta unidades distintas de `PIEZAS/KG/M2` ni montos negativos.

---

## 5. La importación del CSV: ¿qué pasa si una fila está mal?

**Yo:** Si la fila 500 de 1000 tiene una fecha inválida, ¿qué hago con las 499 anteriores?

**IA:** Dos opciones: (a) saltar la fila mala y seguir; (b) transacción completa, o se importa todo o nada.

**Decisión:** (b), con `BEGIN` / `COMMIT` / `ROLLBACK`. Una carga parcial de pólizas es peor que ninguna, porque las estadísticas quedarían incompletas sin que nadie lo note. Además el CSV se lee en *streaming*, no completo en memoria.

**Mejora a futuro:** modo "reporte", que importe las válidas y genere un archivo con las rechazadas.

---

## 6. Ruta para buscar por SAC

**Yo:** El enunciado sugería `/importaciones/:sac`, pero ya existe `/importaciones/:correlativo`.

**IA:** Express no distingue dos rutas con el mismo patrón; la primera declarada gana y la otra nunca se ejecuta.

**Decisión:** `/api/v1/sac/:sac`. El contrato queda sin ambigüedad.

---

## 7. Arquitectura por capas

**Decisión:** `routes → controllers → services → repositories`.
- **routes:** qué URL va a qué función.
- **controllers:** traducen HTTP (req/res) y no tienen lógica de negocio.
- **services:** reglas de negocio (por ejemplo: "si no existe, es 404").
- **repositories:** el único lugar con SQL.

Así, si mañana cambio PostgreSQL por otra cosa, solo toco el repositorio.

---

## 8. Bugs que encontré al probar (con apoyo de la IA)

Al levantar el proyecto contra un PostgreSQL real y probar endpoint por endpoint:

1. **`GET /api/v1/importaciones` respondía 500** (`column x.importacion_id does not exist`). La subconsulta no seleccionaba `importacion_id`, pero el `JOIN` la usaba. **Fix:** agregarla a `ITEM_COLUMNS`.
2. **Reimportar el CSV duplicaba ítems.** El check de idempotencia comparaba `670.780029296875` (CSV) con `670.78002930` (lo que PostgreSQL guardó tras redondear a `NUMERIC(20,8)`) y no eran iguales. **Fix:** castear el parámetro al tipo de la columna (`$10::numeric(20,8)`).
3. **Las fechas salían como `2023-08-30T06:00:00.000Z`.** El driver convierte `DATE` a `Date` de JS y le aplica la zona horaria (Guatemala, UTC-6). **Fix:** `types.setTypeParser(1082, v => v)` para devolver `YYYY-MM-DD`.

**Lección:** que el código "se vea bien" no significa que funcione. Hay que probarlo contra la base de datos real.

---

## Cómo usé la IA (resumen)
- ✅ Para contrastar alternativas (tipos de datos, transacciones, diseño de rutas).
- ✅ Como revisor: me ayudó a entender los errores al probar.
- ✅ Para generar datos de prueba y la colección de Postman.
- ❌ No acepté sugerencias sin entenderlas ni probarlas: cada decisión de arriba la puedo explicar.
