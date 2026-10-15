-- Cabecera de la póliza. Un correlativo = una póliza; sus partidas viven en items_importacion (relación 1-N).
CREATE TABLE IF NOT EXISTS importaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correlativo VARCHAR(40) NOT NULL UNIQUE,
    fecha_declaracion DATE NOT NULL,
    aduana VARCHAR(180) NOT NULL,
    tipo_regimen VARCHAR(160) NOT NULL,
    tipo_cambio_dolar NUMERIC(14,6) NOT NULL CHECK (tipo_cambio_dolar > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT correlativo_no_vacio CHECK (BTRIM(correlativo) <> ''),
    CONSTRAINT aduana_no_vacia CHECK (BTRIM(aduana) <> ''),
    CONSTRAINT regimen_no_vacio CHECK (BTRIM(tipo_regimen) <> '')
);

-- Detalle: una fila por partida SAC. Si se borra la póliza, sus ítems se borran en cascada.
CREATE TABLE IF NOT EXISTS items_importacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    importacion_id BIGINT NOT NULL REFERENCES importaciones(id) ON DELETE CASCADE,
    -- SAC como texto: es un código, no una cantidad, y debe conservar ceros iniciales.
    sac VARCHAR(32) NOT NULL,
    descripcion TEXT NOT NULL,
    pais VARCHAR(120) NOT NULL,
    tipo_unidad_medida VARCHAR(10) NOT NULL,
    -- NUMERIC y no FLOAT: los valores monetarios deben sumarse sin error binario.
    cantidad_fraccion NUMERIC(20,6) NOT NULL CHECK (cantidad_fraccion >= 0),
    tasa_dai NUMERIC(12,6) NOT NULL CHECK (tasa_dai >= 0),
    valor_dai NUMERIC(20,6) NOT NULL CHECK (valor_dai >= 0),
    valor_cif_uds NUMERIC(20,6) NOT NULL CHECK (valor_cif_uds >= 0),
    tasa_cif_cantidad_fraccion NUMERIC(20,8) NOT NULL CHECK (tasa_cif_cantidad_fraccion >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sac_no_vacio CHECK (BTRIM(sac) <> ''),
    CONSTRAINT descripcion_no_vacia CHECK (BTRIM(descripcion) <> ''),
    CONSTRAINT pais_no_vacio CHECK (BTRIM(pais) <> ''),
    CONSTRAINT unidad_medida_valida CHECK (tipo_unidad_medida IN ('PIEZAS', 'KG', 'M2', 'M', 'M3', 'L', 'PARES', 'JUEGOS'))
);

-- Índices para los filtros y ordenamientos de la API (fecha, aduana, SAC, país, FK).
CREATE INDEX IF NOT EXISTS idx_importaciones_fecha ON importaciones(fecha_declaracion DESC);
CREATE INDEX IF NOT EXISTS idx_importaciones_aduana ON importaciones(aduana);
CREATE INDEX IF NOT EXISTS idx_items_sac ON items_importacion(sac);
CREATE INDEX IF NOT EXISTS idx_items_pais ON items_importacion(pais);
CREATE INDEX IF NOT EXISTS idx_items_importacion_id ON items_importacion(importacion_id);

-- Mantiene updated_at al día sin depender de que la aplicación lo envíe.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_importaciones_updated_at ON importaciones;
CREATE TRIGGER trg_importaciones_updated_at
BEFORE UPDATE ON importaciones
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
