import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const allowedCategories = [
  "Smartphone",
  "Laptop & PC",
  "AC",
  "Refrigerator",
  "TV",
  "Washing Machine",
  "Electrical",
];

const allowedServiceModes = [
  "Home Visit",
  "Shop Drop-off",
];

export async function createService(req, res) {
  try {
    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !category ||
      !description?.trim() ||
      !image?.trim() ||
      !estimatedDuration?.trim() ||
      !serviceMode ||
      !serviceArea?.trim() ||
      basePrice === undefined ||
      basePrice === null ||
      basePrice === ""
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    // Validate category
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        message: "Invalid service category.",
      });
    }

    // Validate service mode
    if (!allowedServiceModes.includes(serviceMode)) {
      return res.status(400).json({
        message: "Invalid service mode.",
      });
    }

    // Validate price
    const price = Number(basePrice);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Base price must be a positive number.",
      });
    }

    // Validate image URL
    let imageUrl;

    try {
      imageUrl = new URL(image);

      if (!["http:", "https:"].includes(imageUrl.protocol)) {
        throw new Error("Invalid image URL");
      }
    } catch {
      return res.status(400).json({
        message: "Please provide a valid image URL.",
      });
    }

    const db = getDB();

    // Get technician information from Better Auth user collection
    const technician = await db.collection("user").findOne({
      email: req.user.email,
    });

    if (!technician) {
      return res.status(404).json({
        message: "Technician account not found.",
      });
    }

    const serviceData = {
      title: title.trim(),
      category,
      description: description.trim(),
      image: imageUrl.href,
      basePrice: price,
      estimatedDuration: estimatedDuration.trim(),
      serviceMode,
      serviceArea: serviceArea.trim(),

      technicianName: technician.name,
      technicianEmail: technician.email,

      approvalStatus: "pending",
      isAvailable: true,
      createdAt: new Date(),
    };

    const result = await db.collection("services").insertOne(serviceData);

    return res.status(201).json({
      success: true,
      message: "Service created successfully. Waiting for admin approval.",
      serviceId: result.insertedId,
    });
  } catch (error) {
    console.error("Create Service Error:", error);

    return res.status(500).json({
      message: "Failed to create service.",
    });
  }
}

export async function getAllServices(req, res) {
  try {
    const db = getDB();

    const { search, category, serviceMode, sort } = req.query;

    // Base filter: Only approved and available services
    const filter = {
      approvalStatus: "approved",
      isAvailable: true,
    };

    // Search by service title or category
    if (search?.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { category: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    // Filter by category
    if (category?.trim()) {
      if (!allowedCategories.includes(category.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid service category.",
        });
      }

      filter.category = category.trim();
    }

    // Filter by service mode
    if (serviceMode?.trim()) {
      if (!allowedServiceModes.includes(serviceMode.trim())) {
        return res.status(400).json({
          success: false,
          message: "Invalid service mode.",
        });
      }

      filter.serviceMode = serviceMode.trim();
    }

    // Sorting options
    let sortOptions = { createdAt: -1 };

    switch (sort) {
      case "price-low":
        sortOptions = { basePrice: 1 };
        break;

      case "price-high":
        sortOptions = { basePrice: -1 };
        break;

      case "newest":
      default:
        sortOptions = { createdAt: -1 };
        break;
    }

    const services = await db.collection("services")
      .find(filter)
      .sort(sortOptions)
      .toArray();

    return res.status(200).json({
      success: true,
      totalServices: services.length,
      services,
    });
  } catch (error) {
    console.error("Get All Services Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch services.",
    });
  }
}
export async function getSingleService(req, res) {
  try {
    const { id } = req.params;

    // Validate Service ID
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    const db = getDB();

    const service = await db.collection("services").findOne({
      _id: new ObjectId(id),
      approvalStatus: "approved",
      isAvailable: true,
    });

    if (!service) {
      return res.status(404).json({
        message: "Service not found or unavailable.",
      });
    }

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error("Get Single Service Error:", error);

    return res.status(500).json({
      message: "Failed to fetch service.",
    });
  }
}
export async function getMyServices(req, res) {
  try {
    const db = getDB();

    const services = await db.collection("services")
      .find({
        technicianEmail: req.user.email,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalServices: services.length,
      services,
    });
  } catch (error) {
    console.error("Get My Services Error:", error);

    return res.status(500).json({
      message: "Failed to fetch your services.",
    });
  }
}
export async function updateService(req, res) {
  try {
    const { id } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    const {
      title,
      category,
      description,
      image,
      basePrice,
      estimatedDuration,
      serviceMode,
      serviceArea,
    } = req.body;

    // Validate required fields
    if (
      !title?.trim() ||
      !category ||
      !description?.trim() ||
      !image?.trim() ||
      !estimatedDuration?.trim() ||
      !serviceMode ||
      !serviceArea?.trim() ||
      basePrice === undefined ||
      basePrice === null ||
      basePrice === ""
    ) {
      return res.status(400).json({
        message: "All fields are required.",
      });
    }

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        message: "Invalid service category.",
      });
    }

    if (!allowedServiceModes.includes(serviceMode)) {
      return res.status(400).json({
        message: "Invalid service mode.",
      });
    }

    const price = Number(basePrice);

    if (!Number.isFinite(price) || price <= 0) {
      return res.status(400).json({
        message: "Base price must be a positive number.",
      });
    }

    let imageUrl;

    try {
      imageUrl = new URL(image);

      if (!["http:", "https:"].includes(imageUrl.protocol)) {
        throw new Error("Invalid image URL");
      }
    } catch {
      return res.status(400).json({
        message: "Please provide a valid image URL.",
      });
    }

    const db = getDB();

    const result = await db.collection("services").updateOne(
      {
        _id: new ObjectId(id),
        technicianEmail: req.user.email,
      },
      {
        $set: {
          title: title.trim(),
          category,
          description: description.trim(),
          image: imageUrl.href,
          basePrice: price,
          estimatedDuration: estimatedDuration.trim(),
          serviceMode,
          serviceArea: serviceArea.trim(),
          approvalStatus: "pending",
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you do not have permission.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully. Waiting for admin approval.",
    });
  } catch (error) {
    console.error("Update Service Error:", error);

    return res.status(500).json({
      message: "Failed to update service.",
    });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;

    // Validate Service ID
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    const db = getDB();

    const result = await db.collection("services").deleteOne({
      _id: new ObjectId(id),
      technicianEmail: req.user.email,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you do not have permission.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Service Error:", error);

    return res.status(500).json({
      message: "Failed to delete service.",
    });
  }
}

export async function getAdminServices(req, res) {
  try {
    const db = getDB();
    const { approvalStatus = "pending" } = req.query;

    const allowedStatuses = ["pending", "approved", "rejected", "all"];
    if (!allowedStatuses.includes(approvalStatus)) {
      return res.status(400).json({
        message:
          "Invalid approvalStatus query. Allowed values are: pending, approved, rejected, all.",
      });
    }

    const filter = {};
    if (approvalStatus !== "all") {
      filter.approvalStatus = approvalStatus;
    }

    const services = await db
      .collection("services")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      totalServices: services.length,
      approvalStatus,
      services,
    });
  } catch (error) {
    console.error("Get Admin Services Error:", error);

    return res.status(500).json({
      message: "Failed to fetch admin services.",
    });
  }
}

export async function getPendingServices(req, res) {
  return getAdminServices(req, res);
}

export async function updateServiceApproval(req, res) {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    // Validate Service ID
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    // Validate Approval Status
    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({
        message: "Approval status must be approved or rejected.",
      });
    }

    const db = getDB();

    const result = await db.collection("services").updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          approvalStatus,
          reviewedAt: new Date(),
          reviewedBy: req.user.email,
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Service ${approvalStatus} successfully.`,
    });
  } catch (error) {
    console.error("Update Service Approval Error:", error);

    return res.status(500).json({
      message: "Failed to update service approval.",
    });
  }
}
export async function toggleServiceAvailability(req, res) {
  try {
    const { id } = req.params;
    const { isAvailable } = req.body;

    // Validate Service ID
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({
        message: "Invalid service ID.",
      });
    }

    // Validate Availability
    if (typeof isAvailable !== "boolean") {
      return res.status(400).json({
        message: "isAvailable must be a boolean value.",
      });
    }

    const db = getDB();

    const result = await db.collection("services").updateOne(
      {
        _id: new ObjectId(id),
        technicianEmail: req.user.email,
      },
      {
        $set: {
          isAvailable,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        message: "Service not found or you do not have permission.",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Service ${isAvailable ? "enabled" : "disabled"} successfully.`,
    });
  } catch (error) {
    console.error("Toggle Service Availability Error:", error);

    return res.status(500).json({
      message: "Failed to update service availability.",
    });
  }
}


export async function getAdminServiceStats(req, res) {
  try {
    const db = getDB();
    const servicesCollection = db.collection("services");

    const [
      totalServices,
      approvedServices,
      pendingServices,
      rejectedServices,
    ] = await Promise.all([
      servicesCollection.countDocuments({}),
      servicesCollection.countDocuments({
        approvalStatus: "approved",
      }),
      servicesCollection.countDocuments({
        approvalStatus: "pending",
      }),
      servicesCollection.countDocuments({
        approvalStatus: "rejected",
      }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalServices,
        approvedServices,
        pendingServices,
        rejectedServices,
      },
    });
  } catch (error) {
    console.error("Get Admin Service Stats Error:", error);

    return res.status(500).json({
      message: "Failed to fetch service statistics.",
    });
  }
}