const express = require('express');
const router = express.Router();
const importController = require('../../controllers/importController');
const importHistoryController = require('../../controllers/importHistoryController');


router.post('/inventario', importController.importInventario);
router.post('/maquinas', importController.importMaquinas);
router.get('/history', importHistoryController.listHistory);
router.get('/history/:id', importHistoryController.getHistoryById);
router.post('/history', importHistoryController.createHistory);
router.delete('/history', importHistoryController.clearHistory);

module.exports = router;
