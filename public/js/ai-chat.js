document.addEventListener('DOMContentLoaded', function () {
  const messagesEl = document.getElementById('messages')
  const inputEl = document.getElementById('messageInput')
  const sendBtn = document.getElementById('sendBtn')

  function appendMessage(text, who, html = false) {
    const wrapper = document.createElement('div')
    wrapper.className = 'message ' + (who === 'user' ? 'user' : 'bot')
    const bubble = document.createElement('div')
    bubble.className = 'bubble'
    if (html) {
      bubble.innerHTML = text
    } else {
      bubble.textContent = text
    }
    wrapper.appendChild(bubble)
    messagesEl.appendChild(wrapper)
    messagesEl.scrollTop = messagesEl.scrollHeight
    return wrapper
  }

  function createFoodCards(foods) {
    const cardList = document.createElement('div')
    cardList.className = 'food-card-list'

    foods.forEach(food => {
      const card = document.createElement('article')
      card.className = 'food-card'

      const img = document.createElement('img')
      img.src = food.image || '/images/no-image.png'
      img.alt = food.title || 'Món ăn'
      card.appendChild(img)

      const body = document.createElement('div')
      body.className = 'food-card-body'

      const title = document.createElement('h3')
      title.textContent = food.title || 'Món ăn'
      body.appendChild(title)

      if (food.description) {
        const desc = document.createElement('p')
        desc.textContent = food.description
        body.appendChild(desc)
      }

      const meta = document.createElement('div')
      meta.className = 'food-card-meta'
      meta.textContent = food.price ? `${Number(food.price).toLocaleString('vi-VN')}đ` : ''
      body.appendChild(meta)

      card.appendChild(body)
      cardList.appendChild(card)
    })

    return cardList
  }

  async function sendMessage() {
    const text = inputEl.value.trim()
    if (!text) return
    appendMessage(text, 'user')
    inputEl.value = ''

    try {
      const res = await fetch('/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      const json = await res.json()
      if (json && (json.answer || json.message)) {
        const wrapper = appendMessage(json.answer || json.message, 'bot')
        if (json.foods && Array.isArray(json.foods) && json.foods.length) {
          wrapper.appendChild(createFoodCards(json.foods))
        }
      } else {
        appendMessage('Không nhận được phản hồi từ AI.', 'bot')
      }
    } catch (e) {
      appendMessage('Lỗi khi liên hệ AI: ' + (e.message || e), 'bot')
    }
  }

  sendBtn.addEventListener('click', sendMessage)
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  })
})
