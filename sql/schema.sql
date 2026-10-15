-- Base de datos: polizas
-- Una póliza puede contener múltiples partidas SAC; se normaliza en dos tablas.
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

CREATE TABLE IF NOT EXISTS items_importacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    importacion_id BIGINT NOT NULL REFERENCES importaciones(id) ON DELETE CASCADE,
    -- SAC se guarda como texto para conservar ceros a la izquierda y su formato exacto.
    sac VARCHAR(32) NOT NULL,
    descripcion TEXT NOT NULL,
    pais VARCHAR(120) NOT NULL,
    tipo_unidad_medida VARCHAR(10) NOT NULL,
    cantidad_fraccion NUMERIC(20,6) NOT NULL CHECK (cantidad_fraccion >= 0),
    tasa_dai NUMERIC(12,6) NOT NULL CHECK (tasa_dai >= 0),
    valor_dai NUMERIC(20,6) NOT NULL CHECK (valor_dai >= 0),
    valor_cif_uds NUMERIC(20,6) NOT NULL CHECK (valor_cif_uds >= 0),
    tasa_cif_cantidad_fraccion NUMERIC(20,8) NOT NULL CHECK (tasa_cif_cantidad_fraccion >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sac_no_vacio CHECK (BTRIM(sac) <> ''),
    CONSTRAINT descripcion_no_vacia CHECK (BTRIM(descripcion) <> ''),
    CONSTRAINT pais_no_vacio CHECK (BTRIM(pais) <> ''),
    CONSTRAINT unidad_medida_valida CHECK (tipo_unidad_medida IN ('PIEZAS', 'KG', 'M2'))
);

CREATE INDEX IF NOT EXISTS idx_importaciones_fecha ON importaciones(fecha_declaracion DESC);
CREATE INDEX IF NOT EXISTS idx_importaciones_aduana ON importaciones(aduana);
CREATE INDEX IF NOT EXISTS idx_importaciones_correlativo ON importaciones(correlativo);
CREATE INDEX IF NOT EXISTS idx_items_sac ON items_importacion(sac);
CREATE INDEX IF NOT EXISTS idx_items_pais ON items_importacion(pais);
CREATE INDEX IF NOT EXISTS idx_items_importacion_id ON items_importacion(importacion_id);

-- Actualiza updated_at cuando se modifica la cabecera.
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
