const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/suppliers', supplierController.getAllSuppliers);
router.get('/suppliers/:id', supplierController.getSupplierById);

// Admin routes
router.post('/suppliers', protect, authorize('admin'), supplierController.createSupplier);
router.put('/suppliers/:id', protect, authorize('admin'), supplierController.updateSupplier);
router.delete('/suppliers/:id', protect, authorize('admin'), supplierController.deleteSupplier);
router.get('/suppliers/stats/overview', protect, authorize('admin'), supplierController.getSupplierStats);
router.post('/suppliers/:id/verify-blockchain', protect, authorize('admin'), supplierController.verifySupplierBlockchain);

// Product management
router.post('/suppliers/:id/products', protect, authorize('admin'), supplierController.addProduct);
router.put('/suppliers/:id/products/:productId', protect, authorize('admin'), supplierController.updateProduct);
router.delete('/suppliers/:id/products/:productId', protect, authorize('admin'), supplierController.deleteProduct);

// Orders
router.get('/suppliers/:id/orders', protect, supplierController.getSupplierOrders);

module.exports = router;
