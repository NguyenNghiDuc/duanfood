function isAdminFoodDraftReadyForSave(draft = {}) {
  const title = String(draft.title || '').trim()
  const price = Number(draft.price)
  const categoryId = draft.categoryId ?? draft.category_id
  const hasCategory = Boolean(categoryId || String(draft.category || '').trim())

  return Boolean(title && Number.isFinite(price) && price > 0 && hasCategory)
}

module.exports = {
  isAdminFoodDraftReadyForSave
}
