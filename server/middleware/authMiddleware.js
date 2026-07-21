const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 1. Get the Authorization header sent by the frontend
    const authHeader = req.header('Authorization');

    // 2. The header format is "Bearer <token>". We split it by the space and grab the 2nd part (the actual token)
    const token = authHeader && authHeader.split(' ')[1];

    // 3. If there is no token, immediately reject the request
    if (!token) {
        return res.status(401).json({ message: "Access denied. No authentication token provided." });
    }

    // 4. Verify the token's cryptographic signature
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 5. Attach the decoded user payload (id and role) to the request object
        req.user = decoded;
        
        // 6. Pass control to the next function (the actual route logic)
        next();
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
};