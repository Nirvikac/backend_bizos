import businessDetail from "../models/business_detail_schema.js";

// Onboarding: the signed-up user tells us about their shop. One user
// owns one business, which every other module scopes its queries to.
const createBusinessDetails = async (req, res) => {
  try {
    const {
      organizationName,
      businessType,
      businessCategory,
      businessPhone,
      businessEmail,
      businessAddress,
      currency,
      panNumber,
      vatNumber,
    } = req.body;

    const business = await businessDetail.create({
      ownerId: req.user.id,
      organizationName,
      businessType,
      businessCategory,
      businessPhone,
      businessEmail,
      businessAddress,
      currency,
      panNumber,
      vatNumber,
    });

    return res.status(201).json({
      success: true,
      message: "Business details created successfully",
      businessDetail: business,
    });
  } catch (error) {
    console.error("Create business details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save business details",
    });
  }
};

const getBusinessDetails = async (req, res) => {
  try {
    const business = await businessDetail
      .find({ ownerId: req.user.id })
      .lean();

    // Empty array = the user hasn't onboarded yet. The frontend treats
    // this 404 as "show the onboarding form".
    if (!business || business.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No business details found for this user.",
      });
    }

    return res.status(200).json(business);
  } catch (error) {
    console.error("Get business details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch business details",
    });
  }
};

export { createBusinessDetails, getBusinessDetails };
