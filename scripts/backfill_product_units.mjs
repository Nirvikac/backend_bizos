import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('Missing MONGO_URI env var.');
  process.exit(1);
}

const NUMERIC_UNIT_RE = /^\d+$/;

const productSchema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'BusinessDetail' },
  name: { type: String },
  sku: { type: String },
  unit: { type: String, default: 'piece' },
  isActive: { type: Boolean, default: true },
}, { strict: false });

const Product = mongoose.model('ProductBackfill', productSchema, 'products');

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const cursor = Product.find({
    $or: [
      { unit: { $regex: NUMERIC_UNIT_RE } },
      { unit: { $exists: false } },
      { unit: '' },
    ],
  }).cursor();

  let updated = 0;
  for await (const doc of cursor) {
    await Product.updateOne(
      { _id: doc._id },
      { $set: { unit: 'Piece' } },
    );
    updated++;
  }

  console.log(`Backfill complete. Updated ${updated} product(s) to unit = "Piece".`);
  await mongoose.connection.close();
  console.log('Disconnected.');
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
