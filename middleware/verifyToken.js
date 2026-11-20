import { jwtVerify, createRemoteJWKSet } from "jose";

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)
);

export async function verifyToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Unauthorized! Token is required.",
            });
        }

        const token = authHeader.split(" ")[1];

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: process.env.BETTER_AUTH_URL,
            audience: process.env.BETTER_AUTH_URL,
        });

        req.user = payload;

        next();
    } catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token.",
        });
    }
}