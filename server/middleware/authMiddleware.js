const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function(req, res, next) {
    const authHeader = req.header('Authorization');
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No authentication token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('societyId role approvalStatus');
        if (!user) {
            return res.status(401).json({ message: 'User no longer exists.' });
        }

        if (user.approvalStatus !== 'Approved') {
            return res.status(403).json({ message: 'Your account is pending approval or has been rejected.' });
        }

        req.user = {
            id: decoded.id,
            role: user.role,
            societyId: user.societyId,
            approvalStatus: user.approvalStatus
        };

        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid or expired token.' });
    }
};
