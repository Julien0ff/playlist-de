// ══════════════════════════════════════════════════════
// Suggestify — Admin Authentication Middleware
// ══════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'suggestify-admin-secret-key-2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

/**
 * Generate a JWT token for admin
 */
function generateToken() {
    return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Verify admin password and return token
 */
function login(password) {
    if (password === ADMIN_PASSWORD) {
        return { success: true, token: generateToken() };
    }
    return { success: false, token: null };
}

/**
 * Express middleware: verify JWT in Authorization header
 */
function requireAdmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Non autorisé.' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token invalide ou expiré.' });
    }
}

module.exports = { login, requireAdmin };
