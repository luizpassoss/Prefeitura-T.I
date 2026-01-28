CREATE TABLE IF NOT EXISTS manual_custom_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tab_type VARCHAR(20) NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tab_field (tab_type, field_key)
);

CREATE TABLE IF NOT EXISTS manual_custom_values (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tab_type VARCHAR(20) NOT NULL,
  item_id INT NOT NULL,
  field_key VARCHAR(64) NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_tab_item_field (tab_type, item_id, field_key),
  INDEX idx_tab_item (tab_type, item_id)
);
