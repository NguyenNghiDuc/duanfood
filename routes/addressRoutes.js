const express = require('express')
const router = express.Router()
const addressController = require('../controllers/addressController')
const { requireLogin } = require('../middleware/auth')

router.get('/addresses', addressController.listAddresses)
router.get('/profile/addresses', requireLogin, addressController.listAddresses)
router.get('/profile/addresses/add', requireLogin, addressController.showAddAddress)
router.post('/profile/addresses/add', requireLogin, addressController.createAddress)
router.get('/profile/addresses/edit/:id', requireLogin, addressController.showEditAddress)
router.post('/profile/addresses/edit/:id', requireLogin, addressController.updateAddress)
router.post('/profile/addresses/delete/:id', requireLogin, addressController.deleteAddress)
router.post('/profile/addresses/default/:id', requireLogin, addressController.setDefaultAddress)

module.exports = router
