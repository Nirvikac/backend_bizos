import businessDetail from "../models/business_detail_schema.js";

const createBusinessDetails = async (req, res) => {
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

  try {
    const newBusinessDetail = new businessDetail({
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
    await newBusinessDetail.save();
    res.status(201).json({
      message: "Business details created successfully",
      businessDetail: newBusinessDetail,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBusinessDetails = async (req, res) => {
  try {
    const businessDetails = await businessDetail.find({ ownerId: req.user.id });
    if (!businessDetails || businessDetails.length === 0) {
      return res
        .status(404)
        .json({ message: "No business details found for this user." });
    }
    res.status(200).json(businessDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export { createBusinessDetails, getBusinessDetails };
