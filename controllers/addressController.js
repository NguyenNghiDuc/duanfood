const addressModel = require('../models/addressModel')
const userModel = require('../models/userModels')

async function listAddresses(req, res, next) {
  try {
    if (!req.session.user) {
      return res.render('addresses', {
        addresses: [],
        user: null,
        notice: 'Vui lòng đăng nhập để xem và quản lý địa chỉ giao hàng.'
      })
    }

    const addresses = await addressModel.getAddressesByUsername(req.session.user.username)
    res.render('addresses', { addresses, user: req.session.user, notice: null })
  } catch (error) {
    next(error)
  }
}

function showAddAddress(req, res) {
  res.render('address-add', {
    address: {},
    action: '/profile/addresses/add',
    submitLabel: 'Thêm địa chỉ',
    title: 'Thêm địa chỉ giao hàng',
    error: null
  })
}

async function showEditAddress(req, res, next) {
  try {
    const address = await addressModel.getAddressById(req.params.id, req.session.user.username)
    if (!address) return res.status(404).send('Địa chỉ không tồn tại')
    res.render('address-add', {
      address,
      action: `/profile/addresses/edit/${address.id}`,
      submitLabel: 'Cập nhật địa chỉ',
      title: 'Chỉnh sửa địa chỉ',
      error: null
    })
  } catch (error) {
    next(error)
  }
}

async function createAddress(req, res, next) {
  try {
    const {
      label,
      full_name,
      phone,
      city,
      district,
      ward,
      street,
      detail_address,
      note,
      is_default
    } = req.body

    if (!label || !full_name || !phone || !city || !district || !ward || !street || !detail_address) {
      return res.render('address-add', {
        address: req.body,
        action: '/profile/addresses/add',
        submitLabel: 'Thêm địa chỉ',
        title: 'Thêm địa chỉ giao hàng',
        error: 'Vui lòng điền đầy đủ thông tin địa chỉ.'
      })
    }

    const currentUser = await userModel.findByUsername(req.session.user.username)
    await addressModel.createAddress({
      userId: currentUser ? currentUser.id : null,
      username: req.session.user.username,
      label,
      full_name,
      phone,
      city,
      district,
      ward,
      street,
      detail_address,
      note,
      is_default: is_default === 'on'
    })

    res.redirect('/profile/addresses')
  } catch (error) {
    next(error)
  }
}

async function updateAddress(req, res, next) {
  try {
    const {
      label,
      full_name,
      phone,
      city,
      district,
      ward,
      street,
      detail_address,
      note,
      is_default
    } = req.body

    if (!label || !full_name || !phone || !city || !district || !ward || !street || !detail_address) {
      return res.render('address-add', {
        address: { ...req.body, id: req.params.id },
        action: `/profile/addresses/edit/${req.params.id}`,
        submitLabel: 'Cập nhật địa chỉ',
        title: 'Chỉnh sửa địa chỉ',
        error: 'Vui lòng điền đầy đủ thông tin địa chỉ.'
      })
    }

    await addressModel.updateAddress(req.params.id, req.session.user.username, {
      label,
      full_name,
      phone,
      city,
      district,
      ward,
      street,
      detail_address,
      note,
      is_default: is_default === 'on'
    })

    res.redirect('/profile/addresses')
  } catch (error) {
    next(error)
  }
}

async function deleteAddress(req, res, next) {
  try {
    await addressModel.deleteAddress(req.params.id, req.session.user.username)
    res.redirect('/profile/addresses')
  } catch (error) {
    next(error)
  }
}

async function setDefaultAddress(req, res, next) {
  try {
    await addressModel.setDefaultAddress(req.params.id, req.session.user.username)
    res.redirect('/profile/addresses')
  } catch (error) {
    next(error)
  }
}

module.exports = {
  listAddresses,
  showAddAddress,
  showEditAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
}
