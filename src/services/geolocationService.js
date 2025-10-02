/**
 * Geolocation Service for EUDR Compliance
 * Handles plot-level traceability and deforestation tracking
 */

/**
 * Validate geolocation coordinates
 * @param {Array<Object>} coordinates - Array of coordinate objects {latitude, longitude}
 * @returns {Boolean} - True if valid
 */
const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    throw new Error('At least 3 coordinate points required for a valid plot');
  }

  for (const coord of coordinates) {
    if (!coord.latitude || !coord.longitude) {
      throw new Error('Each coordinate must have latitude and longitude');
    }

    const lat = parseFloat(coord.latitude);
    const lng = parseFloat(coord.longitude);

    if (lat < -90 || lat > 90) {
      throw new Error(`Invalid latitude: ${lat}. Must be between -90 and 90`);
    }

    if (lng < -180 || lng > 180) {
      throw new Error(`Invalid longitude: ${lng}. Must be between -180 and 180`);
    }
  }

  return true;
};

/**
 * Calculate plot area from coordinates using Shoelace formula
 * @param {Array<Object>} coordinates - Array of {latitude, longitude}
 * @returns {Number} - Area in hectares
 */
const calculatePlotArea = (coordinates) => {
  if (coordinates.length < 3) {
    throw new Error('Need at least 3 points to calculate area');
  }

  // Convert to radians and apply Shoelace formula
  const R = 6371000; // Earth's radius in meters
  let area = 0;

  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    const lat1 = (coordinates[i].latitude * Math.PI) / 180;
    const lat2 = (coordinates[j].latitude * Math.PI) / 180;
    const lng1 = (coordinates[i].longitude * Math.PI) / 180;
    const lng2 = (coordinates[j].longitude * Math.PI) / 180;

    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs(area * R * R / 2);
  const hectares = area / 10000; // Convert to hectares

  return parseFloat(hectares.toFixed(4));
};

/**
 * Format geolocation data for EUDR compliance
 * @param {Object} plotData - Plot information
 * @returns {Object} - Formatted EUDR-compliant data
 */
const formatEUDRCompliantData = (plotData) => {
  const {
    farmerId,
    farmerName,
    plotId,
    coordinates,
    commodity,
    productionDate,
    harvestDate,
    legalDocuments = []
  } = plotData;

  validateCoordinates(coordinates);

  const area = calculatePlotArea(coordinates);

  return {
    plotIdentification: {
      plotId,
      farmerId,
      farmerName,
      coordinates: coordinates.map(c => ({
        latitude: parseFloat(c.latitude).toFixed(6),
        longitude: parseFloat(c.longitude).toFixed(6),
        altitude: c.altitude || null,
        accuracy: c.accuracy || null
      })),
      area: {
        value: area,
        unit: 'hectares'
      }
    },
    commodityInformation: {
      type: commodity,
      productionDate: productionDate || new Date().toISOString(),
      harvestDate: harvestDate || null
    },
    complianceStatus: {
      deforestationFree: true, // To be verified through satellite data
      cutOffDate: '2020-12-31',
      verificationDate: new Date().toISOString(),
      legalStatus: 'pending', // To be updated based on document verification
      legalDocuments: legalDocuments.map(doc => ({
        type: doc.type,
        documentId: doc.id,
        issueDate: doc.issueDate,
        expiryDate: doc.expiryDate || null,
        url: doc.url
      }))
    },
    traceability: {
      batchId: `AAF-${plotId}-${Date.now()}`,
      qrCode: null, // To be generated
      blockchainHash: null // To be generated if blockchain integration exists
    }
  };
};

/**
 * Generate geolocation polygon for mapping
 * @param {Array<Object>} coordinates - Coordinate array
 * @returns {Object} - GeoJSON polygon
 */
const generateGeoJSONPolygon = (coordinates) => {
  validateCoordinates(coordinates);

  // Close the polygon if not already closed
  const coords = [...coordinates];
  const first = coords[0];
  const last = coords[coords.length - 1];
  
  if (first.latitude !== last.latitude || first.longitude !== last.longitude) {
    coords.push(first);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        coords.map(c => [parseFloat(c.longitude), parseFloat(c.latitude)])
      ]
    },
    properties: {
      area: calculatePlotArea(coordinates),
      unit: 'hectares'
    }
  };
};

/**
 * Validate plot is within Kenya boundaries (rough check)
 * @param {Array<Object>} coordinates - Coordinate array
 * @returns {Boolean} - True if within Kenya
 */
const validateKenyaBoundaries = (coordinates) => {
  // Kenya approximate boundaries
  const KENYA_BOUNDS = {
    minLat: -4.7,
    maxLat: 5.5,
    minLng: 33.9,
    maxLng: 41.9
  };

  for (const coord of coordinates) {
    const lat = parseFloat(coord.latitude);
    const lng = parseFloat(coord.longitude);

    if (
      lat < KENYA_BOUNDS.minLat ||
      lat > KENYA_BOUNDS.maxLat ||
      lng < KENYA_BOUNDS.minLng ||
      lng > KENYA_BOUNDS.maxLng
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Store geolocation with timestamp and metadata
 * @param {Object} geoData - Geolocation data with metadata
 * @returns {Object} - Enriched geolocation record
 */
const createGeolocationRecord = (geoData) => {
  const {
    farmerId,
    plotId,
    coordinates,
    commodity,
    capturedAt,
    capturedBy,
    deviceInfo,
    photos = []
  } = geoData;

  validateCoordinates(coordinates);

  if (!validateKenyaBoundaries(coordinates)) {
    throw new Error('Plot coordinates are outside Kenya boundaries');
  }

  return {
    farmerId,
    plotId,
    geolocation: {
      coordinates: coordinates.map(c => ({
        latitude: parseFloat(c.latitude).toFixed(6),
        longitude: parseFloat(c.longitude).toFixed(6),
        altitude: c.altitude || null,
        accuracy: c.accuracy || null,
        timestamp: c.timestamp || new Date().toISOString()
      })),
      geoJSON: generateGeoJSONPolygon(coordinates),
      area: calculatePlotArea(coordinates),
      withinKenyaBoundaries: true
    },
    commodity,
    metadata: {
      capturedAt: capturedAt || new Date().toISOString(),
      capturedBy,
      deviceInfo: {
        type: deviceInfo?.type || 'unknown',
        gpsAccuracy: deviceInfo?.gpsAccuracy || null,
        appVersion: deviceInfo?.appVersion || null
      },
      photos: photos.map(photo => ({
        url: photo.url,
        timestamp: photo.timestamp,
        geotagged: photo.geotagged || false,
        coordinates: photo.coordinates || null
      }))
    },
    eudrCompliance: formatEUDRCompliantData({
      farmerId,
      farmerName: geoData.farmerName,
      plotId,
      coordinates,
      commodity,
      productionDate: capturedAt,
      legalDocuments: geoData.legalDocuments || []
    })
  };
};

/**
 * Calculate center point of plot
 * @param {Array<Object>} coordinates - Coordinate array
 * @returns {Object} - Center coordinate
 */
const calculateCenterPoint = (coordinates) => {
  const sum = coordinates.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + parseFloat(coord.latitude),
      longitude: acc.longitude + parseFloat(coord.longitude)
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: (sum.latitude / coordinates.length).toFixed(6),
    longitude: (sum.longitude / coordinates.length).toFixed(6)
  };
};

module.exports = {
  validateCoordinates,
  calculatePlotArea,
  formatEUDRCompliantData,
  generateGeoJSONPolygon,
  validateKenyaBoundaries,
  createGeolocationRecord,
  calculateCenterPoint
};
