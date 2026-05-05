-- Escape Room Database Initialization Script
-- Run this script to set up the database

CREATE DATABASE IF NOT EXISTS escape_room;
USE escape_room;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  role ENUM('ADMIN', 'SUPER_ADMIN', 'USER') NOT NULL DEFAULT 'USER',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_email (email),
  KEY idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  scenario_name VARCHAR(255) NOT NULL,
  customer_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  number_of_players INT NOT NULL,
  reservation_date_time DATETIME NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_customer_email (customer_email),
  KEY idx_scenario (scenario_name),
  KEY idx_status (status),
  KEY idx_date (reservation_date_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample admin user (SUPER_ADMIN)
INSERT INTO users (email, password, first_name, last_name, phone_number, role, active)
VALUES (
  'adminsuper@gmail.com',
  '$2a$10$slYQmyNdGzin7olVi9hFuOYvxXeUQrzqBqKD8H3Jv2FvzPoMt6Wvq',
  'Super',
  'Admin',
  '1234567890',
  'SUPER_ADMIN',
  true
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample admin user (ADMIN)
INSERT INTO users (email, password, first_name, last_name, phone_number, role, active)
VALUES (
  'admin@gmail.com',
  '$2a$10$qc8r7tLs9v0z.qJ5Z6HnZO7eC5y1B3vP.dK2tM5xL8hZ9gG0qK1gS',
  'Admin',
  'User',
  '9876543210',
  'ADMIN',
  true
) ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Insert sample reservations
INSERT INTO reservations (scenario_name, customer_name, customer_email, customer_phone, number_of_players, reservation_date_time, status)
VALUES
('The Mystery of the Ancient Temple', 'Alice Smith', 'alice@example.com', '123456789', 4, DATE_ADD(NOW(), INTERVAL 7 DAY), 'PENDING'),
('Escape from the Matrix', 'Bob Johnson', 'bob@example.com', '987654321', 2, DATE_ADD(NOW(), INTERVAL 14 DAY), 'CONFIRMED'),
('The Locked Vault', 'Carol White', 'carol@example.com', '555666777', 6, DATE_ADD(NOW(), INTERVAL 3 DAY), 'PENDING');

-- Insert sample scenarios
INSERT INTO scenarios (name, description, story_text, min_players, max_players, duration_minutes, difficulty, price, success_rate, active)
VALUES
('The Mystery of the Ancient Temple', 'Uncover the secrets of an ancient temple', 'You are archaeologists exploring a mysterious temple...', 2, 6, 60, 3.5, 50.0, 75, true),
('Escape from the Matrix', 'Break free from the digital world', 'You are trapped in a digital world and must escape...', 2, 4, 45, 3.0, 40.0, 80, true),
('The Locked Vault', 'Crack the code to open a high-security vault', 'A priceless diamond is locked away...', 3, 8, 75, 4.5, 60.0, 70, true),
('Haunted Mansion', 'Survive the night in a cursed house', 'Strange occurrences plague an old mansion...', 2, 5, 50, 4.0, 45.0, 65, true),
('Time Machine Malfunction', 'Fix the time machine before it\'s too late', 'Your time machine has broken down in the past...', 2, 4, 55, 3.0, 35.0, 85, true);

-- Insert sample locations
INSERT INTO locations (name, address, city, zip_code, country, phone, email, description, active)
VALUES
('Tunis Center', '123 Rue de la Liberté', 'Tunis', '1000', 'Tunisia', '+216-71-123456', 'tunis@escape.com', 'Main escape room center in Tunis', true),
('Sfax Branch', '456 Avenue Habib Bourguiba', 'Sfax', '3000', 'Tunisia', '+216-74-234567', 'sfax@escape.com', 'Escape room branch in Sfax', true),
('Sousse Location', '789 Boulevard de la Côte', 'Sousse', '4000', 'Tunisia', '+216-73-345678', 'sousse@escape.com', 'Coastal escape room experience', true);

-- Insert sample email configuration
INSERT INTO email_configuration (smtp_server, smtp_port, sender_email, sender_password, tls_enabled, active)
VALUES
('smtp.gmail.com', 587, 'noreply@escaperoom.com', 'your_app_password_here', true, true);

-- Insert sample email templates
INSERT INTO email_templates (type, subject, body_template, active)
VALUES
('CONFIRMATION', 'Your Escape Room Reservation is Confirmed', 'Dear {customerName},<br><br>Your reservation for {scenarioName} on {date} at {time} has been confirmed.<br><br>We look forward to seeing you!<br><br>Best regards,<br>The Room Team', true),
('REMINDER', 'Reminder: Your Escape Room Adventure Tomorrow', 'Dear {customerName},<br><br>This is a friendly reminder that you have a reservation for {scenarioName} tomorrow at {time}.<br><br>Please arrive 15 minutes early.<br><br>Best regards,<br>The Room Team', true),
('CANCELLATION', 'Your Reservation Has Been Cancelled', 'Dear {customerName},<br><br>Your reservation for {scenarioName} has been cancelled.<br><br>If you have any questions, please contact us.<br><br>Best regards,<br>The Room Team', true),
('WELCOME', 'Welcome to The Room Escape Game', 'Dear {customerName},<br><br>Welcome to our escape room experience! We are thrilled to have you join us.<br><br>Visit our website to book your adventure today.<br><br>Best regards,<br>The Room Team', true);

-- Verify data
SELECT 'Users:' as info;
SELECT COUNT(*) as total_users FROM users;

SELECT 'Reservations:' as info;
SELECT COUNT(*) as total_reservations FROM reservations;

COMMIT;
