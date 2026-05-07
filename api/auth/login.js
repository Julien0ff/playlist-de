const { login } = require('../lib/auth');

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: "Method Not Allowed" });
    }

    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ success: false, message: 'Mot de passe requis.' });
    }

    const result = login(password);
    if (result.success) {
        return res.json({ success: true, token: result.token });
    }

    return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
};
