const test = require('node:test')
const assert = require('node:assert/strict')
const { isAdminFoodDraftReadyForSave } = require('../lib/adminFoodDraft')
const { buildLearningKey, shouldStoreLearningRecord } = require('../lib/aiLearningService')

test('auto-saves a food draft when title, price, and category are present', () => {
  const draft = {
    title: 'Phở bò',
    price: 50000,
    category: 'Món chính',
    categoryId: 2
  }

  assert.equal(isAdminFoodDraftReadyForSave(draft), true)
})

test('does not auto-save when required fields are missing', () => {
  assert.equal(isAdminFoodDraftReadyForSave({ title: 'Phở bò', price: 50000 }), false)
  assert.equal(isAdminFoodDraftReadyForSave({ title: '', price: 50000, category: 'Món chính' }), false)
  assert.equal(isAdminFoodDraftReadyForSave({ title: 'Phở bò', price: 0, category: 'Món chính' }), false)
})

test('builds stable learning keys and skips sensitive content', () => {
  assert.equal(buildLearningKey('món nào rẻ rẻ?'), 'mon-nao-re-re')
  assert.equal(shouldStoreLearningRecord('mật khẩu admin 123'), false)
  assert.equal(shouldStoreLearningRecord('món nào rẻ rẻ?'), true)
})
