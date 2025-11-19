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
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import axios from 'axios';

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

async function sendMailgunEmail({ from, to, subject, html }) {
    if (!process.env.MAILGUN_DOMAIN || !process.env.MAILGUN_API_KEY) {
        throw new Error('Mailgun config missing (MAILGUN_DOMAIN or MAILGUN_API_KEY).');
    }

    const url = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;

    const params = new URLSearchParams();
    params.append('from', from);
    params.append('to', to);
    params.append('subject', subject);
    params.append('html', html);

    const response = await axios.post(url, params.toString(), {
        auth: {
            username: 'api',
            password: process.env.MAILGUN_API_KEY
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
    });

    return response.data;
}

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

        // Build a safe "from" address that matches your Mailgun domain
        const fromAddress =
            process.env.COMPANY_EMAIL ||
            `Insight RTLS <postmaster@${process.env.MAILGUN_DOMAIN}>`;

        if (!fromAddress || !fromAddress.includes('@')) {
            console.error('Invalid fromAddress, check COMPANY_EMAIL / MAILGUN_DOMAIN env vars');
            return res.status(500).json({ success: false, message: 'Email configuration error.' });
        }

        // Send confirmation to user
        await sendMailgunEmail({
            from: fromAddress,
            to: email,
            subject: 'Thanks for contacting Insight RTLS',
            html: userHtml
        });

        // Send notification to you
        await sendMailgunEmail({
            from: fromAddress,
            to: process.env.CONTACT_EMAIL,
            subject: `New contact from ${name}`,
            html: adminHtml
        });

        console.log(`Contact form submitted: ${name} <${email}>`);
        res.json({ success: true });
    } catch (err) {
        console.error('Contact error', err?.response?.data || err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Insight RTLS backend running on port ${PORT}`);
});
