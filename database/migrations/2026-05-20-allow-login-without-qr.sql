-- Remove persistencia de QR Code em banco.
-- Mantem o fluxo de QR apenas em memoria da aplicacao web.

SET @db_name = DATABASE();

-- Remove FK registro_de_pontos -> qr_codes (se existir)
SET @has_fk_qr = (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = @db_name
    AND TABLE_NAME = 'registro_de_pontos'
    AND CONSTRAINT_NAME = 'fk_pontos_qr_code'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @sql_fk_qr = IF(@has_fk_qr > 0, 'ALTER TABLE registro_de_pontos DROP FOREIGN KEY fk_pontos_qr_code', 'SELECT 1');
PREPARE stmt_fk_qr FROM @sql_fk_qr;
EXECUTE stmt_fk_qr;
DEALLOCATE PREPARE stmt_fk_qr;

-- Remove indice do qr_code_id (se existir)
SET @has_idx_qr = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'registro_de_pontos'
    AND INDEX_NAME = 'idx_pontos_qr_code'
);
SET @sql_idx_qr = IF(@has_idx_qr > 0, 'ALTER TABLE registro_de_pontos DROP INDEX idx_pontos_qr_code', 'SELECT 1');
PREPARE stmt_idx_qr FROM @sql_idx_qr;
EXECUTE stmt_idx_qr;
DEALLOCATE PREPARE stmt_idx_qr;

-- Remove coluna qr_code_id (se existir)
SET @has_col_qr = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'registro_de_pontos'
    AND COLUMN_NAME = 'qr_code_id'
);
SET @sql_col_qr = IF(@has_col_qr > 0, 'ALTER TABLE registro_de_pontos DROP COLUMN qr_code_id', 'SELECT 1');
PREPARE stmt_col_qr FROM @sql_col_qr;
EXECUTE stmt_col_qr;
DEALLOCATE PREPARE stmt_col_qr;

-- Remove tabela qr_codes antiga (se existir)
DROP TABLE IF EXISTS qr_codes;
