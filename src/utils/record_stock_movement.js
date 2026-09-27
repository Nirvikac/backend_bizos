import StockMovement from "../models/stock_movement_model.js";

/**
 * Append one entry to the stock movement ledger.
 *
 * `resultQuantity` is stored on the entry so the client can show the
 * running stock level in the timeline without replaying all movements.
 *
 * @param {Object} params
 * @param {string} params.businessId
 * @param {string} params.inventoryId
 * @param {string} params.productId
 * @param {"sale"|"sale_cancelled"|"restock"|"adjustment"|"initial"} params.type
 * @param {number} params.change  signed delta (negative = stock left)
 * @param {number} params.resultQuantity  quantity AFTER the change
 * @param {string|null} [params.saleId]
 * @param {string} [params.invoiceNumber]
 * @param {string} [params.note]
 * @param {import("mongoose").ClientSession|null} [session]  Mongo session when
 *        called inside a transaction (createSale / cancelSale).
 */
const recordStockMovement = async ({
  businessId,
  inventoryId,
  productId,
  type,
  change,
  resultQuantity,
  saleId = null,
  invoiceNumber = "",
  note = "",
  session = null,
}) => {
  const doc = {
    businessId,
    inventoryId,
    productId,
    type,
    change,
    resultQuantity,
    saleId,
    invoiceNumber,
    note,
  };

  if (session) {
    await StockMovement.create([doc], { session });
  } else {
    await StockMovement.create(doc);
  }
};

export default recordStockMovement;
