const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. Extract the token from the request header
    // We expect the frontend to send the token in a header called 'x-auth-token'
    const token = req.header('x-auth-token');

    // 2. If there is no token, immediately reject the request
    if (!token) {
        return res.status(401).json({ message: "Access denied. No authentication token provided." });
    }

    // 3. Verify the token's cryptographic signature
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. Attach the decoded user payload (id and role) to the request object
        req.user = decoded;
        
        // 5. Pass control to the next function (the actual route logic)
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
};