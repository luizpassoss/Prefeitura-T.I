CREATE TABLE IF NOT EXISTS `recent_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message` varchar(255) NOT NULL,
  `tag` varchar(50) DEFAULT 'Ação',
  `user_name` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_recent_actions_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `import_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `import_type` varchar(30) NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `user_name` varchar(120) DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `status_label` varchar(50) NOT NULL,
  `error_count` int(11) NOT NULL DEFAULT 0,
  `success_count` int(11) NOT NULL DEFAULT 0,
  `module_id` int(11) DEFAULT NULL,
  `payload` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_import_history_created_at` (`created_at`),
  KEY `idx_import_history_type` (`import_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
