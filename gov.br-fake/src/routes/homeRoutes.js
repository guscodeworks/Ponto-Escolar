'use strict';

const { Router } = require('express');
const homeController = require('../controllers/homeController');

const router = Router();

router.get('/', homeController.showHome);
router.get('/index.html', homeController.showHome);
router.get('/govbr', homeController.showGovbrPage);
router.get('/govbr.html', (_req, res) => res.redirect('/govbr'));
router.get('/visual', (_req, res) => res.redirect('/visual.html'));
router.get('/visual.html', homeController.showVisualPage);
router.get('/views/admin/dashboard.html', homeController.startPontoEscolarAdmin);
router.get('/service-info', homeController.showServiceInfo);

module.exports = router;
