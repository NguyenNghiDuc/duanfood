const express = require('express')
const router = express.Router()
const addressController = require('../controllers/addressController')
const { requireLogin } = require('../middleware/auth')

router.use(requireLogin)
router.get('/addresses', addressController.listAddresses)
router.get('/profile/addresses', addressController.listAddresses)
router.get('/profile/addresses/add', addressController.showAddAddress)
router.post('/profile/addresses/add', addressController.createAddress)
router.get('/profile/addresses/edit/:id', addressController.showEditAddress)
router.post('/profile/addresses/edit/:id', addressController.updateAddress)
router.post('/profile/addresses/delete/:id', addressController.deleteAddress)
router.post('/profile/addresses/default/:id', addressController.setDefaultAddress)

module.exports = router
