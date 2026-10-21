const mongoose = require('mongoose');

/**
 * GeoJSON Point ([longitude, latitude]) - the standard MongoDB geospatial format.
 * Stored under `geo` on every stop so it can be queried with 2dsphere indexes.
 */
const GeoPointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: {
    type: [Number],
    validate: {
      validator: (v) =>
        Array.isArray(v) && v.length === 2 &&
        v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
      message: 'coordinates must be [longitude, latitude] within valid ranges'
    }
  }
}, { _id: false });

// How a stop's coordinates were obtained (shown in the UI so users know how much to trust a pin)
const GEO_SOURCES = ['ai', 'geocoded', 'approximate', 'manual'];

const PlaceRefSchema = new mongoose.Schema({
  name: { type: String },
  geo: { type: GeoPointSchema },
  radiusKm: { type: Number }
}, { _id: false });

const ActivitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  estimatedCostUSD: { type: Number, default: 0 },
  timeOfDay: { type: String, enum: ['Morning', 'Afternoon', 'Evening', 'Night'] },
  location: { type: String },
  duration: { type: String },
  tips: { type: String },
  mapsSearchQuery: { type: String },
  geo: { type: GeoPointSchema },
  geoSource: { type: String, enum: GEO_SOURCES }
});

const MealSchema = new mongoose.Schema({
  mealTime: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'] },
  restaurantName: { type: String },
  cuisine: { type: String },
  mustTry: { type: String },
  estimatedCostUSD: { type: Number, default: 0 },
  location: { type: String },
  geo: { type: GeoPointSchema },
  geoSource: { type: String, enum: GEO_SOURCES }
});

const DailyCostBreakdownSchema = new mongoose.Schema({
  activities: { type: Number, default: 0 },
  meals: { type: Number, default: 0 },
  transport: { type: Number, default: 0 },
  misc: { type: Number, default: 0 },
  dayTotal: { type: Number, default: 0 }
});

const TripSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  from: { type: String },
  destination: { type: String, required: true },
  destinationGeo: { type: PlaceRefSchema },
  originGeo: { type: PlaceRefSchema },
  routeDistanceKm: { type: Number }, // great-circle distance origin -> destination
  durationDays: { type: Number, required: true },
  budgetTier: { type: String, enum: ['Low', 'Medium', 'High'], required: true },
  interests: [{ type: String }],
  travelType: { type: String, enum: ['solo', 'couple', 'family', 'friends'], default: 'solo' },
  travelers: { type: Number, default: 1, min: 1 },
  tripSummary: { type: mongoose.Schema.Types.Mixed },
  transportation: { type: mongoose.Schema.Types.Mixed },
  importantTips: { type: mongoose.Schema.Types.Mixed },
  nearbyAttractions: [{ type: mongoose.Schema.Types.Mixed }],
  itinerary: [{
    dayNumber: { type: Number, required: true },
    dayTheme: { type: String },
    activities: [ActivitySchema],
    meals: [MealSchema],
    dailyCostBreakdown: DailyCostBreakdownSchema
  }],
  accommodation: [{
    name: { type: String },
    type: { type: String },
    area: { type: String },
    estimatedCostPerNightUSD: { type: Number },
    rating: { type: String },
    whyRecommended: { type: String },
    bookingTip: { type: String },
    geo: { type: GeoPointSchema },
    geoSource: { type: String, enum: GEO_SOURCES }
  }],
  hotels: [{
    name: { type: String, required: true },
    tier: { type: String },
    estimatedCostNightUSD: { type: Number },
    rating: { type: String }
  }],
  estimatedBudget: {
    transport: { type: Number, default: 0 },
    accommodation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    activities: { type: Number, default: 0 },
    shopping: { type: Number, default: 0 },
    misc: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    budgetTips: [{ type: String }]
  },
  packingList: [{
    item: { type: String, required: true },
    category: {
      type: String,
      enum: ['Documents', 'Clothing', 'Gear', 'Medicine', 'Electronics', 'Other'],
      default: 'Other'
    },
    isPacked: { type: Boolean, default: false },
    isEssential: { type: Boolean, default: false }
  }],
  usdToInrRate: { type: Number, default: 83 }
}, { timestamps: true });

// ---- Geospatial indexes (2dsphere enables $near / $geoWithin / $geoIntersects) ----
TripSchema.index({ userId: 1, createdAt: -1 });
TripSchema.index({ 'destinationGeo.geo': '2dsphere' });
TripSchema.index({ 'originGeo.geo': '2dsphere' });
TripSchema.index({ 'itinerary.activities.geo': '2dsphere' });
TripSchema.index({ 'itinerary.meals.geo': '2dsphere' });
TripSchema.index({ 'accommodation.geo': '2dsphere' });

module.exports = mongoose.model('Trip', TripSchema);
module.exports.GEO_SOURCES = GEO_SOURCES;
