const FarmerProfile = require('../models/FarmerProfile');
const {
  validateCoordinates,
  calculatePlotArea,
  formatEUDRCompliantData,
  generateGeoJSONPolygon,
  validateKenyaBoundaries,
  createGeolocationRecord,
  calculateCenterPoint
} = require('../services/geolocationService');

// @desc    Add or update farm geolocation
// @route   POST /api/geolocation/farm
// @access  Private (Farmer)
const addFarmGeolocation = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      plotId,
      coordinates,
      commodity,
      photos,
      legalDocuments,
      deviceInfo
    } = req.body;

    // Validate coordinates
    try {
      validateCoordinates(coordinates);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    // Validate Kenya boundaries
    if (!validateKenyaBoundaries(coordinates)) {
      return res.status(400).json({
        success: false,
        message: 'Plot coordinates must be within Kenya'
      });
    }

    // Find farmer profile
    const farmer = await FarmerProfile.findOne({ user: userId });
    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    // Create geolocation record
    const geoRecord = createGeolocationRecord({
      farmerId: userId.toString(),
      farmerName: `${req.user.firstName} ${req.user.lastName}`,
      plotId: plotId || `PLOT-${Date.now()}`,
      coordinates,
      commodity: commodity || 'Mixed crops',
      capturedAt: new Date(),
      capturedBy: userId.toString(),
      deviceInfo,
      photos: photos || [],
      legalDocuments: legalDocuments || []
    });

    // Update or add to farmer's geolocation data
    if (!farmer.farmDetails) {
      farmer.farmDetails = {};
    }
    if (!farmer.farmDetails.geolocation) {
      farmer.farmDetails.geolocation = [];
    }

    // Check if plot already exists
    const existingPlotIndex = farmer.farmDetails.geolocation.findIndex(
      geo => geo.plotId === geoRecord.plotId
    );

    if (existingPlotIndex >= 0) {
      farmer.farmDetails.geolocation[existingPlotIndex] = geoRecord;
    } else {
      farmer.farmDetails.geolocation.push(geoRecord);
    }

    await farmer.save();

    res.json({
      success: true,
      message: 'Farm geolocation saved successfully',
      data: {
        plotId: geoRecord.plotId,
        area: geoRecord.geolocation.area,
        centerPoint: calculateCenterPoint(coordinates),
        eudrCompliant: true,
        geolocation: geoRecord
      }
    });
  } catch (error) {
    console.error('Add farm geolocation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save farm geolocation',
      error: error.message
    });
  }
};

// @desc    Get farm geolocation data
// @route   GET /api/geolocation/farm/:farmerId?
// @access  Private
const getFarmGeolocation = async (req, res) => {
  try {
    const farmerId = req.params.farmerId || req.user._id;

    const farmer = await FarmerProfile.findOne({ user: farmerId })
      .populate('user', 'firstName lastName email');

    if (!farmer) {
      return res.status(404).json({
        success: false,
        message: 'Farmer profile not found'
      });
    }

    const geolocationData = farmer.farmDetails?.geolocation || [];

    res.json({
      success: true,
      data: {
        farmerId: farmer.user._id,
        farmerName: `${farmer.user.firstName} ${farmer.user.lastName}`,
        plots: geolocationData.map(geo => ({
          plotId: geo.plotId,
          area: geo.geolocation.area,
          coordinates: geo.geolocation.coordinates,
          geoJSON: geo.geolocation.geoJSON,
          commodity: geo.commodity,
          centerPoint: calculateCenterPoint(geo.geolocation.coordinates),
          eudrCompliance: geo.eudrCompliance,
          capturedAt: geo.metadata.capturedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get farm geolocation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve farm geolocation'
    });
  }
};

// @desc    Validate plot coordinates
// @route   POST /api/geolocation/validate
// @access  Private
const validatePlotCoordinates = async (req, res) => {
  try {
    const { coordinates } = req.body;

    if (!coordinates || !Array.isArray(coordinates)) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates array is required'
      });
    }

    try {
      validateCoordinates(coordinates);
      const inKenya = validateKenyaBoundaries(coordinates);
      const area = calculatePlotArea(coordinates);
      const centerPoint = calculateCenterPoint(coordinates);

      res.json({
        success: true,
        data: {
          valid: true,
          withinKenya: inKenya,
          area: {
            value: area,
            unit: 'hectares'
          },
          centerPoint,
          numberOfPoints: coordinates.length
        }
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
        data: {
          valid: false
        }
      });
    }
  } catch (error) {
    console.error('Validate coordinates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coordinates'
    });
  }
};

// @desc    Generate EUDR compliance report for plot
// @route   POST /api/geolocation/eudr-report
// @access  Private
const generateEUDRReport = async (req, res) => {
  try {
    const {
      plotId,
      farmerId,
      farmerName,
      coordinates,
      commodity,
      productionDate,
      harvestDate,
      legalDocuments
    } = req.body;

    if (!coordinates || !commodity) {
      return res.status(400).json({
        success: false,
        message: 'Coordinates and commodity are required'
      });
    }

    try {
      validateCoordinates(coordinates);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const eudrData = formatEUDRCompliantData({
      farmerId: farmerId || req.user._id.toString(),
      farmerName: farmerName || `${req.user.firstName} ${req.user.lastName}`,
      plotId: plotId || `PLOT-${Date.now()}`,
      coordinates,
      commodity,
      productionDate,
      harvestDate,
      legalDocuments: legalDocuments || []
    });

    res.json({
      success: true,
      message: 'EUDR compliance report generated',
      data: eudrData
    });
  } catch (error) {
    console.error('Generate EUDR report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate EUDR report'
    });
  }
};

// @desc    Get all plots for traceability
// @route   GET /api/geolocation/traceability
// @access  Private (Admin/Exporter)
const getTraceabilityData = async (req, res) => {
  try {
    const { commodity, startDate, endDate } = req.query;

    const query = { 'farmDetails.geolocation': { $exists: true, $ne: [] } };

    const farmers = await FarmerProfile.find(query)
      .populate('user', 'firstName lastName email phone')
      .lean();

    let allPlots = [];

    farmers.forEach(farmer => {
      const plots = farmer.farmDetails?.geolocation || [];
      plots.forEach(plot => {
        // Filter by commodity if specified
        if (commodity && plot.commodity !== commodity) {
          return;
        }

        // Filter by date if specified
        const plotDate = new Date(plot.metadata.capturedAt);
        if (startDate && plotDate < new Date(startDate)) return;
        if (endDate && plotDate > new Date(endDate)) return;

        allPlots.push({
          farmerId: farmer.user._id,
          farmerName: `${farmer.user.firstName} ${farmer.user.lastName}`,
          farmerContact: farmer.user.phone,
          plotId: plot.plotId,
          commodity: plot.commodity,
          area: plot.geolocation.area,
          coordinates: plot.geolocation.coordinates,
          geoJSON: plot.geolocation.geoJSON,
          batchId: plot.eudrCompliance.traceability.batchId,
          eudrCompliant: plot.eudrCompliance.complianceStatus.deforestationFree,
          capturedAt: plot.metadata.capturedAt
        });
      });
    });

    res.json({
      success: true,
      data: {
        totalPlots: allPlots.length,
        plots: allPlots,
        filters: { commodity, startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Get traceability data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve traceability data'
    });
  }
};

module.exports = {
  addFarmGeolocation,
  getFarmGeolocation,
  validatePlotCoordinates,
  generateEUDRReport,
  getTraceabilityData
};
