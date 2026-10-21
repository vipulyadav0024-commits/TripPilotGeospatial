const express = require('express');
const router = express.Router();
const tripController = require('../controllers/tripController');
const auth = require('../middleware/auth');

router.post('/', auth, tripController.generateNewTrip);
router.get('/', auth, tripController.fetchUserTrips);

// Ad-hoc place search (must come before the generic '/:id' route)
router.get('/geocode', auth, tripController.geocodePlace);

router.get('/:id', auth, tripController.getTripById);
router.put('/:id', auth, tripController.updateTrip);
router.delete('/:id', auth, tripController.deleteTrip);
router.post('/:id/regenerate-day', auth, tripController.regenerateDay);

// --- Geospatial features ---
router.get('/:id/geo', auth, tripController.getTripGeoView);
router.post('/:id/geo/refresh', auth, tripController.refreshTripGeo);
router.get('/:id/nearby', auth, tripController.findNearbyStops);
router.get('/:id/optimize-day/:dayNumber', auth, tripController.previewDayOptimization);
router.post('/:id/optimize-day/:dayNumber', auth, tripController.applyDayOptimization);

module.exports = router;
