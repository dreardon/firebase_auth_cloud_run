const express = require('express');
const admin = require('firebase-admin');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firebase Admin
console.log('Initializing with default credentials...');
admin.initializeApp({projectId: process.env.GOOGLE_CLOUD_PROJECT});

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Middleware to check if user is authenticated
async function checkAuth(req, res, next) {
    const sessionCookie = req.cookies.session || '';

    try {
        const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
        req.user = decodedClaims;
        next();
    } catch (error) {
        res.redirect('/login');
    }
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/api/config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

app.post('/sessionLogin', async (req, res) => {
    const idToken = req.body.idToken;
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Ensure email is verified if it exists (Google, Email Link)
        // Anonymous users won't have an email field usually
        if (decodedToken.email && !decodedToken.email_verified) {
            return res.status(401).send('EMAIL_NOT_VERIFIED');
        }

        const sessionCookie = await admin.auth().createSessionCookie(idToken, { expiresIn });
        const options = { maxAge: expiresIn, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
        res.cookie('session', sessionCookie, options);
        res.json({ status: 'success' });
    } catch (error) {
        console.error('Session Login Error:', error);
        res.status(401).send('UNAUTHORIZED REQUEST!');
    }
});

app.get('/sessionLogout', (req, res) => {
    res.clearCookie('session');
    res.redirect('/');
});

app.get('/api/user', async (req, res) => {
    const sessionCookie = req.cookies.session || '';
    try {
        const decodedClaims = await admin.auth().verifySessionCookie(sessionCookie, true);
        res.json({ user: decodedClaims });
    } catch (error) {
        res.status(401).json({ user: null });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
