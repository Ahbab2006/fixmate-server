export function verifyRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user || !req.user.role) {
        return res.status(403).json({
          success: false,
          message: "Access denied! User role not found.",
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden! You do not have permission.",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Authorization failed.",
      });
    }
  };
}

// Role-specific middleware
export const verifyCustomer = verifyRole("customer");

export const verifyTechnician = verifyRole("technician");

export const verifyAdmin = verifyRole("admin");