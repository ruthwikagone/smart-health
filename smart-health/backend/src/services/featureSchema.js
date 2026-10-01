const db = require('../config/db');

let ensurePromise = null;

async function hasColumn(table, column) {
  const safeTable = String(table || '').replace(/[`]/g, '');
  const safeColumn = String(column || '').replace(/[`]/g, '');

  if (!safeTable || !safeColumn) return false;

  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [safeTable, safeColumn]
  );

  return result.rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!await hasColumn(table, column)) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function createFeatureTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS medical_reports (
      id VARCHAR(36) PRIMARY KEY,
      patient_id VARCHAR(36) NOT NULL,
      appointment_id VARCHAR(36),
      name VARCHAR(180) NOT NULL,
      type VARCHAR(80) NOT NULL,
      hospital VARCHAR(180),
      doctor VARCHAR(120),
      report_date DATE NOT NULL,
      description TEXT,
      findings TEXT,
      recommendation TEXT,
      file_name VARCHAR(220),
      file_type VARCHAR(40),
      file_size INT DEFAULT 0,
      status VARCHAR(60) DEFAULT 'Uploaded',
      content LONGTEXT NOT NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id VARCHAR(36) PRIMARY KEY,
      patient_id VARCHAR(36) NOT NULL,
      appointment_id VARCHAR(36),
      doctor_name VARCHAR(120),
      patient_name VARCHAR(120),
      prescription_date DATE NOT NULL,
      diagnosis TEXT NOT NULL,
      medicines JSON NOT NULL,
      notes TEXT,
      content LONGTEXT NOT NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_record_links (
      id VARCHAR(36) PRIMARY KEY,
      appointment_id VARCHAR(36) NOT NULL,
      record_type ENUM('report','prescription') NOT NULL,
      record_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_appointment_record (appointment_id, record_type, record_id),
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS appointment_notes (
      id VARCHAR(36) PRIMARY KEY,
      appointment_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NOT NULL,
      note TEXT NOT NULL,
      visible_to_patient TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      center_id VARCHAR(36) NULL,
      doctor_id VARCHAR(36) NULL,
      appointment_id VARCHAR(36) NULL,
      category VARCHAR(60) NOT NULL DEFAULT 'General',
      rating TINYINT NOT NULL,
      subject VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      status ENUM('new','in_review','resolved') NOT NULL DEFAULT 'new',
      admin_response TEXT NULL,
      responded_by VARCHAR(36) NULL,
      responded_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await addColumnIfMissing('feedback', 'doctor_id', 'VARCHAR(36) NULL');
  await addColumnIfMissing('appointments', 'consultation_type', "VARCHAR(20) NOT NULL DEFAULT 'in_person'");
  await addColumnIfMissing('appointments', 'telemedicine_status', "VARCHAR(20) NOT NULL DEFAULT 'not_requested'");
  await addColumnIfMissing('appointments', 'telemedicine_room_id', 'VARCHAR(100) NULL');
  await addColumnIfMissing('appointments', 'telemedicine_enabled_at', 'DATETIME NULL');
  await addColumnIfMissing('appointments', 'follow_up_date', 'DATE NULL');
  await addColumnIfMissing('appointments', 'follow_up_note', 'TEXT NULL');
  await addColumnIfMissing('reviews', 'doctor_id', 'VARCHAR(36) NULL');
  await addColumnIfMissing('reviews', 'appointment_id', 'VARCHAR(36) NULL');
}

function ensureFeatureSchema() {
  if (!ensurePromise) {
    ensurePromise = createFeatureTables().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

module.exports = { ensureFeatureSchema };
