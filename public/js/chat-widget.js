;(function(){
  function el(tag, attrs, ...children){
    const e = document.createElement(tag)
    for(const k in attrs) e.setAttribute(k, attrs[k])
    children.forEach(c => { if (typeof c === 'string') e.appendChild(document.createTextNode(c)); else e.appendChild(c) })
    return e
  }

  const btn = el('button',{id:'chat-btn','aria-label':'Chat hỗ trợ'}, '💬')
  const panel = el('div',{id:'chat-panel'})
  const avatar = el('div',{class:'avatar'}, 'MF')
  const title = el('div',{class:'title'}, 'Trợ lý Mini Food')
  const controls = el('div',{class:'controls'})
  const btnMin = el('button', {type:'button', title:'Thu nhỏ'}, '—')
  const btnClose = el('button', {type:'button', title:'Đóng'}, '✕')
  controls.appendChild(btnMin); controls.appendChild(btnClose)
  const header = el('div',{class:'chat-header'})
  header.appendChild(avatar); header.appendChild(title); header.appendChild(controls)
  const cartLink = el('a', {href:'/cart', class:'chat-cart', title:'Xem giỏ hàng'})
  const cartCount = el('span', {class:'chat-cart-count'}, '0')
  cartLink.appendChild(cartCount)
  header.appendChild(cartLink)
  const messages = el('div',{id:'chat-messages'})
  const form = el('form',{id:'chat-form'})
  const input = el('input',{id:'chat-input','placeholder':'Gõ câu hỏi...','autocomplete':'off'})
  const uploadInput = el('input',{id:'chat-upload-input', type:'file', accept:'image/jpeg,image/png,image/webp', hidden:'hidden'})
  const uploadBtn = el('button',{type:'button', id:'chat-upload-btn', title:'Gửi ảnh'}, '📷')
  const send = el('button',{type:'submit'}, 'Gửi')
  const previewWrap = el('div',{id:'chat-image-preview', class:'hidden'})
  const previewImg = el('img',{alt:'Preview ảnh món'})
  const previewRemove = el('button',{type:'button', id:'chat-image-remove', title:'Xóa ảnh'}, '✕')
  previewWrap.appendChild(previewImg)
  previewWrap.appendChild(previewRemove)

  form.appendChild(input); form.appendChild(uploadBtn); form.appendChild(send)
  panel.appendChild(header); panel.appendChild(messages); panel.appendChild(previewWrap); panel.appendChild(form)
  form.appendChild(uploadInput)

  const appState = window.__MINI_FOOD_APP || { user: null, cartCount: 0 }
  const STORAGE_KEY = 'mini_food_chat_draft'
  let pendingImageFile = null
  let pendingImageUrl = null

  function persistDraft() {
    try {
      const payload = {
        text: input.value.trim(),
        image: pendingImageUrl || null,
        hasImage: !!pendingImageFile,
        pendingFileName: pendingImageFile ? pendingImageFile.name : '',
        updatedAt: Date.now()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      // ignore storage failure
    }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const payload = JSON.parse(raw)
      if (!payload || typeof payload !== 'object') return
      if (payload.text) input.value = payload.text
      if (payload.hasImage && payload.pendingFileName) {
        const saved = document.querySelector('#chat-upload-input')
        if (saved) saved.value = ''
      }
    } catch (error) {
      // ignore restore failure
    }
  }

  function updateCartCountDisplay(count) {
    if (cartCount) cartCount.innerText = String(count)
  }

  function showImagePreview(file) {
    if (!file || !/^image\//.test(file.type)) {
      addMessage('Chỉ hỗ trợ ảnh JPG, JPEG, PNG, WEBP.', 'bot')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      addMessage('Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 5MB.', 'bot')
      return
    }
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    pendingImageFile = file
    pendingImageUrl = URL.createObjectURL(file)
    previewImg.src = pendingImageUrl
    previewWrap.classList.remove('hidden')
  }

  function clearPendingImage() {
    pendingImageFile = null
    if (pendingImageUrl) URL.revokeObjectURL(pendingImageUrl)
    pendingImageUrl = null
    previewWrap.classList.add('hidden')
    previewImg.src = ''
    uploadInput.value = ''
    try { localStorage.removeItem(STORAGE_KEY) } catch (error) {}
  }

  uploadBtn.addEventListener('click', () => uploadInput.click())
  uploadInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0]
    if (!file) return
    showImagePreview(file)
    persistDraft()
  })
  previewRemove.addEventListener('click', clearPendingImage)
  input.addEventListener('input', persistDraft)
  form.addEventListener('dragover', (event) => {
    event.preventDefault()
    form.classList.add('dragover')
  })
  form.addEventListener('dragleave', () => form.classList.remove('dragover'))
  form.addEventListener('drop', (event) => {
    event.preventDefault()
    form.classList.remove('dragover')
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    if (file) showImagePreview(file)
  })
  async function fetchCartSummary() {
    try {
      const response = await fetch('/api/cart/summary')
      if (!response.ok) return
      const data = await response.json()
      if (data && typeof data.count === 'number') updateCartCountDisplay(data.count)
    } catch (error) {
      // ignore
    }
  }
  updateCartCountDisplay(appState.cartCount)
  fetchCartSummary()
  async function addToCart(item) {
    try {
      const response = await fetch(`/api/cart/add/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        addMessage(payload.error || 'Không thể thêm món vào giỏ.', 'bot')
        return
      }
      const data = await response.json()
      updateCartCountDisplay(data.count || 0)
      addMessage(`Đã thêm ${item.title} vào giỏ hàng.`, 'bot')
    } catch (error) {
      addMessage('Lỗi khi thêm vào giỏ hàng.', 'bot')
    }
  }

  function loadChatIndex() {
    return new Promise((resolve) => {
      const fetchIndex = () => {
        fetch('/data/chat-index.json')
          .then((r) => r.json())
          .then((items) => {
            const index = (items || []).map((i) => ({
              ...i,
              text: (i.title + ' ' + (i.description || '')).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
            }))
            window.__CHAT_INDEX = index
            resolve(index)
          })
          .catch(() => {
            window.__CHAT_INDEX = []
            resolve([])
          })
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        document.body.appendChild(btn)
        document.body.appendChild(panel)
        fetchIndex()
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(btn)
          document.body.appendChild(panel)
          fetchIndex()
        })
      }
    })
  }

  const indexPromise = loadChatIndex()
  restoreDraft()

  btn.addEventListener('click', ()=>{
    panel.classList.toggle('open')
    input.focus()
  })

  function formatTime(date){
    const d = date || new Date();
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
  }

  function addMessage(text, from='bot'){
    const wrap = el('div', {class: 'chat-msg ' + from})
    const content = document.createElement('div')
    content.innerText = text
    const time = el('span', {class: 'time'}, formatTime())
    wrap.appendChild(content)
    wrap.appendChild(time)
    messages.appendChild(wrap)
    messages.scrollTop = messages.scrollHeight
  }

  function addMessageHTML(html, from='bot'){
    const wrap = el('div', {class: 'chat-msg ' + from})
    const content = document.createElement('div')
    content.innerHTML = html
    const time = el('span', {class: 'time'}, formatTime())
    wrap.appendChild(content)
    wrap.appendChild(time)
    messages.appendChild(wrap)
    messages.scrollTop = messages.scrollHeight
  }

  function isSupportQuery(q){
    const keywords = ['lỗi', 'sự cố', 'bị lỗi', 'bị sự cố', 'vấn đề', 'chậm', 'treo', 'không vào', 'hỏng', 'lỗi web', 'web lỗi', 'website lỗi', 'wed lỗi']
    const contactWords = ['liên hệ', 'hỗ trợ', 'support', 'contact']
    const hasSupport = keywords.some(k => q.includes(k))
    const hasContact = contactWords.some(k => q.includes(k))
    return (q.includes('web') || q.includes('website') || q.includes('wed')) && hasSupport || hasContact
  }

  function addCards(items){
    const wrap = el('div', {class: 'chat-msg bot'})
    const container = document.createElement('div')
    container.style.display = 'flex'
    container.style.gap = '8px'
    container.style.flexWrap = 'wrap'

    items.forEach(it => {
      const card = document.createElement('div')
      card.style.width = '100%'
      card.style.maxWidth = '160px'
      card.style.borderRadius = '10px'
      card.style.overflow = 'hidden'
      card.style.background = '#fff'
      card.style.boxShadow = '0 6px 18px rgba(20,24,30,0.06)'
      card.style.cursor = 'pointer'

      const img = document.createElement('img')
      img.src = it.image || '/images/no-image.png'
      img.alt = it.title
      img.style.width = '100%'
      img.style.height = '96px'
      img.style.objectFit = 'cover'

      const body = document.createElement('div')
      body.style.padding = '8px'
      const displayPrice = it.price !== undefined && it.price !== null
        ? (typeof it.price === 'number'
          ? Number(it.price).toLocaleString('vi-VN') + '₫'
          : String(it.price))
        : ''
      body.innerHTML = `<strong style="display:block;margin-bottom:6px;font-size:14px">${it.title}</strong><div style="font-size:13px;color:#666">${displayPrice}</div>`

      const btnWrap = document.createElement('div')
      btnWrap.style.marginTop = '8px'
      const addBtn = document.createElement('button')
      addBtn.type = 'button'
      addBtn.innerText = 'Thêm vào giỏ'
      addBtn.style.background = '#ff6b35'
      addBtn.style.border = 'none'
      addBtn.style.color = '#fff'
      addBtn.style.padding = '6px 8px'
      addBtn.style.borderRadius = '6px'
      addBtn.style.cursor = 'pointer'
      addBtn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        addToCart(it)
        addBtn.innerText = 'Đã thêm'
        setTimeout(()=> addBtn.innerText = 'Thêm vào giỏ', 1500)
      })

      btnWrap.appendChild(addBtn)

      card.appendChild(img)
      card.appendChild(body)
      card.appendChild(btnWrap)
      card.addEventListener('click', ()=>{ window.location.href = it.url })

      container.appendChild(card)
    })

    wrap.appendChild(container)
    messages.appendChild(wrap)
    messages.scrollTop = messages.scrollHeight
  }

  function showTyping(){
    if (messages.querySelector('.typing')) return
    const t = el('div',{class:'typing'})
    t.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'
    messages.appendChild(t)
    messages.scrollTop = messages.scrollHeight
  }

  function hideTyping(){
    const t = messages.querySelector('.typing')
    if (t) t.remove()
  }

  // handle submit by sending the query to the backend chat endpoint
  form.addEventListener('submit', async (e)=>{
    e.preventDefault()
    const text = input.value.trim()
    if (!text && !pendingImageFile) return

    if (text) addMessage(text,'user')
    const hasImage = !!pendingImageFile
    if (hasImage) {
      const previewText = text ? `${text}` : 'Ảnh món ăn'
      addMessage(previewText + ' [Ảnh gửi kèm]', 'user')
    }
    input.value = ''

    try{
      showTyping()
      let res
      if (hasImage) {
        const formData = new FormData()
        formData.append('message', text || '')
        formData.append('image', pendingImageFile)
        res = await fetch('/api/chat', { method: 'POST', body: formData })
      } else {
        res = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message: text})})
      }
      hideTyping()
      if (!res || !res.ok) {
        const payload = await res.json().catch(() => ({}))
        addMessage(payload.reply || payload.message || 'Không thể kết nối với trợ lý. Vui lòng thử lại sau.', 'bot')
        clearPendingImage()
        return
      }

      const ct = res.headers.get('content-type') || ''
      if (ct.includes('application/json')){
        const j = await res.json()
        if (j.reply) addMessage(j.reply)
        if (j && (j.type === 'admin_food_success' || /đã thêm món|da them mon|thành công/i.test(j.reply || ''))) {
          setTimeout(() => {
            const target = window.location.pathname === '/foods' ? '/foods?success=created' : '/foods?success=created'
            window.location.href = target
          }, 500)
        }
        if (Array.isArray(j.cards) && j.cards.length) addCards(j.cards)
      } else {
        const t = await res.text()
        addMessage(t || 'Không có phản hồi')
      }
      clearPendingImage()
    } catch (err) {
      hideTyping()
      clearPendingImage()
      addMessage('Lỗi kết nối', 'bot')
    }
  })
})()