import businessDetail from "../models/business_detail_schema.js";

/**
 * The single business a user owns, or null while they haven't onboarded.
 *
 * Nearly every controller starts with this lookup; having it in one place
 * keeps that rule (business scoping) consistent everywhere. Pass a Mongo
 * session when the lookup happens inside a transaction.
 */
const getOwnedBusiness = (ownerId, session = null) => {
  const query = businessDetail.findOne({ ownerId });

  return session ? query.session(session) : query;
};

export default getOwnedBusiness;
