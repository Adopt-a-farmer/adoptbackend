const express = require('express');
const router = express.Router();
const {
  getCrowdfundingProjects,
  getCrowdfundingProject,
  createCrowdfundingProject,
  backProject,
  verifyCrowdfundingPayment,
  addProjectUpdate
} = require('../controllers/crowdfundingController');
const { protect, authorize } = require('../middleware/auth');

// Project routes
router.get('/projects', getCrowdfundingProjects);
router.get('/projects/:id', getCrowdfundingProject);
router.post('/projects', protect, authorize(['farmer']), createCrowdfundingProject);
router.post('/projects/:id/back', protect, backProject);
router.post('/projects/:id/updates', protect, addProjectUpdate);

// Payment routes
router.post('/verify-payment', protect, verifyCrowdfundingPayment);

module.exports = router;