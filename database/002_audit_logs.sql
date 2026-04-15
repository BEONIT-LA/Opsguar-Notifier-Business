-- ─────────────────────────────────────────────────────────────
-- 002: Tabla de auditoría
-- Reemplaza los archivos NDJSON en /logs
-- Ventaja: queries con filtros, paginación real, índices
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  job_id      VARCHAR(100),
  status      VARCHAR(20)  NOT NULL,          -- completed | failed
  session_id  VARCHAR(100),
  group_id    VARCHAR(200),
  type        VARCHAR(20),                    -- text | image | document
  text        TEXT,                           -- preview del mensaje
  image_path  VARCHAR(500),
  doc_path    VARCHAR(500),
  ip          VARCHAR(50),
  duration    INTEGER,                        -- milisegundos
  attempt     SMALLINT     DEFAULT 1,         -- número de intento (1-5)
  error       TEXT,                           -- mensaje de error si falló
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Índices para las consultas más frecuentes del frontend
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_session_id  ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_status      ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_date        ON audit_logs((created_at::date));
