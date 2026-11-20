
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

// Get Own Profile (Authenticated User)
export async function getMyProfile(req, res) {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized! User identity not verified.",
      });
    }

    const db = getDB();
    const user = await db.collection("user").findOne(
      { email: req.user.email },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          image: 1,
          phone: 1,
          area: 1,
          bio: 1,
          createdAt: 1,
        },
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      profile: {
        name: user.name || "",
        email: user.email,
        role: user.role || "customer",
        image: user.image || null,
        phone: user.phone || "",
        area: user.area || "",
        bio: user.bio || "",
        createdAt: user.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Get My Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch profile.",
    });
  }
}

// Update Own Profile (Authenticated User)
export async function updateUserProfile(req, res) {
  try {
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized! User identity not verified.",
      });
    }

    const { name, phone, area, bio, image } = req.body;

    const updateFields = {};

    // Validate and sanitize Name (if provided)
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name cannot be empty.",
        });
      }
      updateFields.name = name.trim();
    }

    // Validate Phone (if provided)
    if (phone !== undefined) {
      if (typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid phone number format.",
        });
      }
      updateFields.phone = phone.trim();
    }

    // Validate Area (if provided)
    if (area !== undefined) {
      if (typeof area !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid area format.",
        });
      }
      updateFields.area = area.trim();
    }

    // Validate Bio (if provided)
    if (bio !== undefined) {
      if (typeof bio !== "string") {
        return res.status(400).json({
          success: false,
          message: "Invalid bio format.",
        });
      }
      updateFields.bio = bio.trim();
    }

    // Validate Image URL (if provided)
    if (image !== undefined) {
      if (image === null || image === "") {
        updateFields.image = null;
      } else {
        if (typeof image !== "string") {
          return res.status(400).json({
            success: false,
            message: "Invalid image URL.",
          });
        }
        try {
          const parsedUrl = new URL(image.trim());
          if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error();
          }
          updateFields.image = parsedUrl.href;
        } catch {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid image URL.",
          });
        }
      }
    }

    // Ensure at least one valid field is provided for update
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid profile fields provided for update.",
      });
    }

    updateFields.updatedAt = new Date();

    const db = getDB();
    const result = await db.collection("user").updateOne(
      { email: req.user.email },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    // Retrieve updated profile
    const updatedUser = await db.collection("user").findOne(
      { email: req.user.email },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          image: 1,
          phone: 1,
          area: 1,
          bio: 1,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: {
        name: updatedUser.name || "",
        email: updatedUser.email,
        role: updatedUser.role || "customer",
        image: updatedUser.image || null,
        phone: updatedUser.phone || "",
        area: updatedUser.area || "",
        bio: updatedUser.bio || "",
      },
    });
  } catch (error) {
    console.error("Update User Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
}

// Get All Users (Admin Only)
export async function getAllUsers(req, res) {
  try {
    const db = getDB();

    const users = await db.collection("user")
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            role: 1,
            image: 1,
            createdAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);

    return res.status(500).json({
      message: "Failed to fetch users.",
    });
  }
}

// Update User Role (Admin Only)
export async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate User ID
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid user ID.",
      });
    }

    // Validate Role
    const allowedRoles = ["customer", "technician", "admin"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role.",
      });
    }

    const db = getDB();
    const usersCollection = db.collection("user");
    const userId = new ObjectId(id);

    // Find Target User
    const targetUser = await usersCollection.findOne(
      { _id: userId },
      { projection: { email: 1 } }
    );

    if (!targetUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Admin cannot change their own role
    if (targetUser.email === req.user.email) {
      return res.status(403).json({
        message: "You cannot change your own role.",
      });
    }

    const result = await usersCollection.updateOne(
      { _id: userId },
      {
        $set: {
          role,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User role updated successfully.",
    });
  } catch (error) {
    console.error("Update User Role Error:", error);

    return res.status(500).json({
      message: "Failed to update user role.",
    });
  }
}
