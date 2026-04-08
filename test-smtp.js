require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function testConnection() {
  console.log('Testing SMTP connection for:', process.env.SMTP_USER);
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const success = await transporter.verify();
    if (success) {
      console.log('✅ SMTP Connection successful! Your credentials are valid.');
    }
  } catch (error) {
    console.error('❌ SMTP Connection failed:');
    console.error(error.message);
    if (error.responseCode === 535) {
      console.log('\n--- ⚠️ TROUBLESHOOTING 535 ERROR ---');
      console.log('1. Go to https://myaccount.google.com/security');
      console.log('2. Ensure "2-Step Verification" is ON.');
      console.log('3. Search for "App passwords" in your Google Account settings.');
      console.log('4. Create a new App Password for "Mail" / "Other (Custom name)".');
      console.log('5. Copy the 16-character password.');
      console.log('6. Update .env.local: SMTP_PASS=the16characterpassword (NO SPACES)');
    }
  }
}

testConnection();
