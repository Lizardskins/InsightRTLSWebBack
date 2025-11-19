/**
 * Insight RTLS Backend - index.js
 * Express server that handles contact form submissions and sends emails via Mailgun.
 *
 * Usage:
 * - Copy `backend.env.example` to `.env` and fill in values
 * - npm install
 * - npm start
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { FormData } from 'form-data';
import Mailgun from 'mailgun.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Mailgun client only if API key (and domain) are provided.
let mg = null;
if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    try {
        const mailgun = new Mailgun(FormData);
        mg = mailgun.client({ username: 'api', key: process.env.MAILGUN_API_KEY });
    } catch (e) {
        console.warn('Failed to initialize Mailgun client:', e?.message || e);
        mg = null;
    }
} else {
    console.warn('MAILGUN_API_KEY or MAILGUN_DOMAIN not set — email sending is disabled.\n  Copy backend.env.example to .env and fill MAILGUN_API_KEY and MAILGUN_DOMAIN to enable Mailgun.');
}

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, phone, company, message } = req.body || {};

        if (!name || !email || !message) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, message: 'Invalid email address' });
        }

        // Simple HTML templates
        const userHtml = `
      <p>Hi ${name},</p>
      <p>Thanks for contacting Insight RTLS — we've received your message and will respond shortly.</p>
      <hr>
      <p><strong>Message:</strong></p>
      <p>${(message || '').replace(/\n/g, '<br>')}</p>
    `;

        const adminHtml = `
      <p>New contact form submission</p>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
        ${company ? `<li><strong>Company:</strong> ${company}</li>` : ''}
      </ul>
      <p>${(`<strong>Message:</strong> ${message}` || '').replace(/\n/g, '<br>')}</p>
    `;

        // send to user (confirmation) and admin
        // Ensure mailgun is configured
        if (!mg) {
            console.warn('Attempt to send contact message but Mailgun is not configured');
            return res.status(503).json({ success: false, message: 'Email service not configured on server.' });
        }

        const fromAddress =
            process.env.COMPANY_EMAIL ||
            `Insight RTLS <noreply@${process.env.MAILGUN_DOMAIN}>`;

        console.log('Mailgun fromAddress:', JSON.stringify(fromAddress));

        await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: fromAddress,
            to: email,
            subject: 'Thanks for contacting Insight RTLS',
            html: userHtml
        });

        await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: fromAddress,
            to: process.env.CONTACT_EMAIL,
            subject: `New contact from ${name}`,
            html: adminHtml,
            'h:Reply-To': email
        });

        console.log(`Contact form submitted: ${name} <${email}>`);
        res.json({ success: true });
    } catch (err) {
        console.error('Contact error', err || err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Insight RTLS backend running on port ${PORT}`);
});
