const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'suggestify-admin-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

function generateToken() {
    return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
}

function login(password) {
    if (password === ADMIN_PASSWORD) {
        return { success: true, token: generateToken() };
    }
    return { success: false, token: null };
}

/**
 * Helper to check admin auth in Vercel Functions
 */
function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded.role === 'admin';
    } catch (err) {
        return false;
    }
}

module.exports = { login, verifyAdmin };
