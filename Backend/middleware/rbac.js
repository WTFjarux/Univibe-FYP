const { getAdminModel } = require("../config/database");

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const AdminRole = getAdminModel("AdminRole");
    const adminRole = await AdminRole.findOne({
      user: req.user._id,
      isActive: true,
    });

    if (!adminRole) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    req.adminRole = adminRole;
    next();
  } catch (error) {
    console.error("RBAC Error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking admin permissions",
    });
  }
};

const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.adminRole) {
        return res.status(403).json({
          success: false,
          message: "Admin role not found",
        });
      }

      if (!req.adminRole.hasPermission(permission)) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: ${permission}`,
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error checking permissions",
      });
    }
  };
};

module.exports = { requireAdmin, requirePermission };
