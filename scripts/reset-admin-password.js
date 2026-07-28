import db from '../server/db.js';
import bcrypt from 'bcryptjs';

const newPassword = process.argv[2];

if (!newPassword) {
  console.error("Error: Please provide the new password.");
  console.log("Usage: node scripts/reset-admin-password.js <new_password>");
  process.exit(1);
}

try {
  const admin = db.prepare("SELECT id FROM users WHERE email = 'admin@admin.com'").get();
  if (!admin) {
    console.error("Error: Admin user (admin@admin.com) not found in database.");
    process.exit(1);
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, admin.id);

  console.log("----------------------------------------");
  console.log("Successfully updated Admin password!");
  console.log("User: admin@admin.com");
  console.log("----------------------------------------");
} catch (err) {
  console.error("Error updating Admin password:", err);
  process.exit(1);
}
