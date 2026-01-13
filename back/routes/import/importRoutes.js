const express = require('express');
const router = express.Router();
const importController = require('../../controllers/importController');


router.post('/inventario', importController.importInventario);
router.post('/maquinas', importController.importMaquinas);

module.exports = router;
