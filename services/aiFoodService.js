const foodModel = require("../models/foodModels");

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function moneyToNumber(value) {
  if (!value) return null;

  const str = String(value)
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(",", ".");

  const number = parseFloat(str);

  if (Number.isNaN(number)) return null;

  if (str.includes("trieu")) {
    return number * 1000000;
  }

  if (str.includes("k")) {
    return number * 1000;
  }

  return number;
}

/* =================================
   PHÂN TÍCH GIÁ
================================= */

function detectPrice(text) {
  const t = normalize(text);

  let minPrice = null;
  let maxPrice = null;
  let sort = "newest";

  // dưới 70k
  let match = t.match(
    /(?:duoi|<|nho hon|khong qua|toi da|tam gia)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|000)?/
  );

  if (match) {
    maxPrice = moneyToNumber(
      match[1] + (match[2] || "")
    );
  }

  // trên 50k
  match = t.match(
    /(?:tren|>|lon hon|tu)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|000)?/
  );

  if (match && !t.includes("tu thap") && !t.includes("tu cao")) {
    minPrice = moneyToNumber(
      match[1] + (match[2] || "")
    );
  }

  // 50k - 100k
  match = t.match(
    /(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan)?\s*(?:-|den|toi)\s*(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan)?/
  );

  if (match) {
    minPrice = moneyToNumber(
      match[1] + (match[2] || "")
    );

    maxPrice = moneyToNumber(
      match[3] + (match[4] || match[2] || "")
    );
  }

  // rẻ nhất
  if (
    /re nhat|gia thap nhat|thap nhat|tu thap den cao|thap den cao/.test(t)
  ) {
    sort = "price_asc";
  }

  // đắt nhất
  if (
    /dat nhat|gia cao nhat|cao nhat|tu cao den thap|cao den thap/.test(t)
  ) {
    sort = "price_desc";
  }

  // sắp xếp giá
  if (
    /gia.*thap.*cao|thap.*cao/.test(t)
  ) {
    sort = "price_asc";
  }

  if (
    /gia.*cao.*thap|cao.*thap/.test(t)
  ) {
    sort = "price_desc";
  }

  return {
    minPrice,
    maxPrice,
    sort
  };
}

/* =================================
   CATEGORY
================================= */

function detectCategory(text) {
  const t = normalize(text);

  const categories = [
    ["do uong", "Đồ uống"],
    ["nuoc uong", "Đồ uống"],
    ["uống gi", "Đồ uống"],

    ["trai cay", "Trái cây"],

    ["rau", "Rau củ"],
    ["rau cu", "Rau củ"],

    ["hai san", "Hải sản"],
    ["ca", "Hải sản"],
    ["tom", "Hải sản"],

    ["gao", "Gạo - Mì"],
    ["mi", "Gạo - Mì"],

    ["sua", "Sữa và sản phẩm từ sữa"],
    ["pho mai", "Sữa và sản phẩm từ sữa"],

    ["banh keo", "Bánh kẹo"],

    ["banh mi", "Bánh mì"],

    ["gia vi", "Gia vị"],

    ["dong lanh", "Thực phẩm đông lạnh"],

    ["thuc pham kho", "Thực phẩm khô"]
  ];

  for (const [keyword, category] of categories) {
    if (t.includes(keyword)) {
      return category;
    }
  }

  return "";
}

/* =================================
   NGUYÊN LIỆU
================================= */

function detectIngredient(text) {
  const t = normalize(text);

  const ingredients = [
    "thit",
    "ga",
    "bo",
    "ca",
    "tom",
    "trung",
    "rau",
    "sua",
    "pho mai",
    "xuc xich",
    "hai san",
    "nam",
    "dau phu"
  ];

  for (const ingredient of ingredients) {
    if (t.includes(ingredient)) {
      return ingredient;
    }
  }

  return "";
}

/* =================================
   INTENT
================================= */

function detectIntent(text) {
  const t = normalize(text);

  if (
    /gia|bao nhieu tien|bao nhieu|re nhat|dat nhat|thap cao|cao thap/.test(t)
  ) {
    return "SEARCH_PRICE";
  }

  if (
    /tim mon|co mon|mon nao|an gi|goi y|tu van|mon ngon/.test(t)
  ) {
    return "SEARCH_FOOD";
  }

  if (
    /do uong|nuoc uong|uong gi/.test(t)
  ) {
    return "SEARCH_CATEGORY";
  }

  if (
    /danh gia|sao|review|ngon khong/.test(t)
  ) {
    return "SEARCH_RATING";
  }

  if (
    /don hang|don cua toi|don o dau|trang thai don/.test(t)
  ) {
    return "ORDER";
  }

  if (
    /giao hang|phi giao|ship|van chuyen/.test(t)
  ) {
    return "DELIVERY";
  }

  if (
    /gio hang|them vao gio|mua/.test(t)
  ) {
    return "CART";
  }

  return "SEARCH_FOOD";
}

/* =================================
   HƯƠNG VỊ
================================= */

function detectFlavor(text) {
  const t = normalize(text);

  if (t.includes("cay")) return "cay";
  if (t.includes("ngot")) return "ngot";
  if (t.includes("man")) return "man";
  if (t.includes("chua")) return "chua";
  if (t.includes("beo")) return "beo";

  return "";
}

/* =================================
   PHÂN TÍCH TOÀN BỘ
================================= */

function analyzeQuestion(text) {
  const normalized = normalize(text);

  const price = detectPrice(normalized);

  // detect budget like "100k" and people like "2 nguoi" separately
  const budgetMatch = normalized.match(/(\d+(?:[.,]\d+)?\s*(k|nghin|ngan|000)?)/);
  const peopleMatch = normalized.match(/\b(\d+)\s*(?:nguoi|ng|nguoỉ|người)\b/);

  let budget = null;
  let people = null;

  if (budgetMatch) {
    budget = moneyToNumber(budgetMatch[1] || null);
  }

  if (peopleMatch) {
    people = Number(peopleMatch[1]) || null;
  }

  return {
    original: text,
    normalized,

    intent: detectIntent(normalized),

    category: detectCategory(normalized),

    ingredient: detectIngredient(normalized),

    flavor: detectFlavor(normalized),

    minPrice: price.minPrice,

    maxPrice: price.maxPrice,

    sort: price.sort,

    budget,

    people
  };
}

/* =================================
   FUZZY MATCH / TYPO HANDLING
================================= */

function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const matrix = [];
  const alen = a.length;
  const blen = b.length;
  for (let i = 0; i <= blen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= alen; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= blen; i++) {
    for (let j = 1; j <= alen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  return matrix[blen][alen];
}

async function fuzzySearch(keyword, limit = 10) {
  if (!keyword) return [];
  // fetch foods and score by similarity
  const foods = await foodModel.getFoods();
  const k = normalize(keyword);
  const scored = foods.map(f => {
    const title = normalize(f.title || "");
    const ing = normalize(f.ingredients || "");
    const desc = normalize(f.description || "");
    const tgt = title + " " + ing + " " + desc;
    const distance = levenshtein(k, title);
    const contains = tgt.includes(k) ? 0 : distance;
    // small score combining contains + distance and rating
    const score = (tgt.includes(k) ? 1000 : Math.max(0, 200 - contains)) + (Number(f.avg_rating || 0) * 10);
    return { food: f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.food);
}

/* =================================
   ALTERNATIVES
================================= */

async function suggestAlternatives(foodId, limit = 6) {
  const target = await foodModel.getFoodById(foodId);
  if (!target) return [];

  const price = Number(target.price || 0);
  const low = Math.max(0, price * 0.8);
  const high = price * 1.2;

  // search same category first
  let candidates = await foodModel.searchFoodsSmart({ category: target.category_name || '', minPrice: low, maxPrice: high, limit: 50 });

  // exclude itself
  candidates = candidates.filter(f => f.id !== target.id);

  // boost similarity by shared ingredients
  const targIng = normalize(target.ingredients || '');

  const scored = candidates.map(f => {
    let score = 0;
    if (f.category_name === target.category_name) score += 20;
    const common = (normalize(f.ingredients || '') + ' ' + normalize(f.title || '')).split(' ').filter(Boolean).filter(w => targIng.includes(w));
    score += common.length * 5;
    score += Number(f.avg_rating || 0) * 5;
    // closer price better
    score += Math.max(0, 10 - Math.abs(Number(f.price || 0) - price) / (price || 1) * 10);
    return { food: f, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.food);
}

/* =================================
   REVIEW ANALYSIS
================================= */

function tokenizeWords(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9\s\p{L}]/gu, ' ').split(/\s+/).filter(Boolean);
}

async function analyzeReviews(foodId) {
  const reviews = await foodModel.getReviewsByFoodId(foodId);
  const summary = {
    reviewCount: reviews.length,
    avgRating: 0,
    positives: [],
    negatives: []
  };

  if (!reviews.length) return summary;

  const stopwords = new Set(['la', 'rat', 'khong', 'ko', 'không', 'va', 'và', 'that', 'nhieu', 'nhung', 'giu']);

  let total = 0;
  const posFreq = {};
  const negFreq = {};

  for (const r of reviews) {
    const rating = Number(r.rating || 0);
    total += rating;
    const tokens = tokenizeWords(r.comment || '');
    for (const t of tokens) {
      if (stopwords.has(t) || t.length < 2) continue;
      if (rating >= 4) posFreq[t] = (posFreq[t] || 0) + 1;
      if (rating <= 2) negFreq[t] = (negFreq[t] || 0) + 1;
    }
  }

  summary.avgRating = total / reviews.length;

  const top = (freq) => Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>({word:k,count:v}));

  summary.positives = top(posFreq);
  summary.negatives = top(negFreq);

  return summary;
}

/* =================================
   CART CALCULATION
================================= */

async function calculateCart(items = [], deliveryCompanyId = null) {
  // items: [{foodId, quantity}]
  let subtotal = 0;
  const details = [];

  for (const it of items) {
    const f = await foodModel.getFoodById(it.foodId);
    if (!f) continue;
    const qty = Number(it.quantity || 1);
    const line = Number(f.price || 0) * qty;
    subtotal += line;
    details.push({ food: f, quantity: qty, line });
  }

  const companies = await foodModel.getDeliveryCompanies();
  let fee = 0;
  if (deliveryCompanyId) {
    const sel = companies.find(c => String(c.id) === String(deliveryCompanyId));
    if (sel) fee = Number(sel.fee || 0);
  } else if (companies && companies.length) {
    fee = Number(companies[0].fee || 0);
  }

  const total = subtotal + fee;

  return { subtotal, fee, total, details };
}

/* =================================
   TÌM MÓN
================================= */

async function findFoods(text) {
  const analysis = analyzeQuestion(text);

  // If user provided a budget, return combos instead of single-food list
  if (analysis.budget) {
    const combos = await suggestCombos(analysis.budget, analysis.people || 1);

    return {
      analysis,
      foods: [],
      combos
    };
  }

  let foods = await foodModel.searchFoodsSmart({
    category: analysis.category,
    ingredient: analysis.ingredient,
    minPrice: analysis.minPrice,
    maxPrice: analysis.maxPrice,
    sort: analysis.sort,
    limit: 10
  });

  // Nếu không tìm thấy theo điều kiện
  // thì thử tìm keyword tổng quát.
  if (
    foods.length === 0 &&
    !analysis.category &&
    !analysis.ingredient &&
    analysis.intent === "SEARCH_FOOD"
  ) {
    foods = await foodModel.searchFoodsSmart({
      keyword: analysis.normalized,
      sort: analysis.sort,
      limit: 10
    });
  }

  // Fallback: nếu vẫn không có kết quả, thử tách các token và tìm theo từng token
  if (foods.length === 0 && analysis.normalized) {
    const tokens = analysis.normalized.split(" ").filter(Boolean);

    for (const token of tokens) {
      const partial = await foodModel.searchFoodsSmart({
        keyword: token,
        sort: analysis.sort,
        limit: 10
      });

      if (partial.length) {
        // merge unique by id
        const ids = new Set(foods.map(f => f.id));
        for (const f of partial) if (!ids.has(f.id)) { foods.push(f); ids.add(f.id); }
      }

      if (foods.length >= 10) break;
    }
  }

    // If still no foods, try fuzzy search
    if (foods.length === 0 && analysis.normalized) {
      const fuzzy = await fuzzySearch(analysis.normalized, 10);
      if (fuzzy.length) foods = fuzzy;
    }

  return {
      analysis,
      foods
  };
}

/* =================================
   GỢI Ý COMBO THEO NGÂN SÁCH
================================= */

async function suggestCombos(budget, people = 1, options = {}) {
  // budget in VND
  const perPerson = Math.max(1, Number(budget || 0) / Math.max(1, people));

  // If group (people>1), we build combos per person and scale totals later
  const targetBudget = people > 1 ? perPerson : Number(budget || 0);

  // fetch candidate mains (exclude drinks), drinks, desserts
  const mains = await foodModel.searchFoodsSmart({ sort: 'price_asc', limit: 30 });
  const drinks = await foodModel.searchFoodsSmart({ category: 'Đồ uống', sort: 'price_asc', limit: 20 });
  const desserts = await foodModel.searchFoodsSmart({ category: 'Bánh kẹo', sort: 'price_asc', limit: 20 });

  // filter mains to exclude drinks category
  const mainsFiltered = mains.filter(f => String(f.category_name || '').toLowerCase() !== 'đồ uống');

  // Fallback strategies for drinks/desserts:
  // 1) if category lists empty, try matching by common keywords (title/ingredients)
  // 2) otherwise fallback to cheapest items
  const allCheapest = await foodModel.searchFoodsSmart({ sort: 'price_asc', limit: 50 });

  const drinksKeywords = ['sua','milk','tra','trasua','tra sua','nuoc','nuoc ngot','juice','coffee','ca phe','cafe','pepsi','cola','nước','matcha','milkshake','soda','cafe'];
  const dessertsKeywords = ['banh','kem','che','chế','trang mieng','banh keo','banh mi','banhngot','dessert','tráng miệng','pudding','cookie','cake','tiramisu'];

  let drinksFinal = (drinks && drinks.length) ? drinks : [];
  if (drinksFinal.length === 0) {
    const seen = new Set();
    for (const kw of drinksKeywords) {
      const res = await foodModel.searchFoodsSmart({ keyword: kw, sort: 'price_asc', limit: 20 });
      for (const r of res) {
        if (!seen.has(r.id)) { drinksFinal.push(r); seen.add(r.id); }
        if (drinksFinal.length >= 20) break;
      }
      if (drinksFinal.length >= 20) break;
    }
  }

  let dessertsFinal = (desserts && desserts.length) ? desserts : [];
  if (dessertsFinal.length === 0) {
    const seen2 = new Set();
    for (const kw of dessertsKeywords) {
      const res = await foodModel.searchFoodsSmart({ keyword: kw, sort: 'price_asc', limit: 20 });
      for (const r of res) {
        if (!seen2.has(r.id)) { dessertsFinal.push(r); seen2.add(r.id); }
        if (dessertsFinal.length >= 20) break;
      }
      if (dessertsFinal.length >= 20) break;
    }
  }

  if (drinksFinal.length === 0) drinksFinal = allCheapest.slice(0,20);
  if (dessertsFinal.length === 0) dessertsFinal = allCheapest.slice(0,20);

  const combos = [];

  // Try combos main + drink + dessert (use fallback lists)
  for (const main of mainsFiltered.slice(0, 20)) {
    for (const drink of drinksFinal.slice(0, 10)) {
      for (const dessert of dessertsFinal.slice(0, 6)) {
        const total = Number(main.price || 0) + Number(drink.price || 0) + Number(dessert.price || 0);
        if (total <= targetBudget) {
          combos.push({ items: [main, drink, dessert], total, score: total });
        }
      }

      // also try main + drink only
      const total2 = Number(main.price || 0) + Number(drink.price || 0);
      if (total2 <= targetBudget) {
        combos.push({ items: [main, drink], total: total2, score: total2 });
      }
    }
  }

  // if no combos found, try two-item combos (main + dessert)
  if (combos.length === 0) {
    for (const main of mainsFiltered.slice(0, 30)) {
      for (const dessert of desserts.slice(0, 10)) {
        const total = Number(main.price || 0) + Number(dessert.price || 0);
        if (total <= targetBudget) combos.push({ items: [main, dessert], total, score: total });
      }
    }
  }

  // sort combos by score descending (closer to budget first), then by avg rating
  combos.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    const ra = (b.items[0]?.avg_rating || 0) - (a.items[0]?.avg_rating || 0);
    return ra;
  });

  let results = combos.slice(0, 12);

  if (people > 1) {
    // scale totals for group and annotate quantities
    results = results.map(r => ({
      items: r.items.map(i => ({ ...i, quantity: people })),
      total: r.total * people,
      score: r.score
    }));
  }

  return results;
}

/* =================================
   FORMAT TIỀN
================================= */

function formatMoney(value) {
  return Number(value || 0).toLocaleString("vi-VN") + "đ";
}

/* =================================
   TẠO CÂU TRẢ LỜI
================================= */

function buildAnswer(data) {
  const {
    analysis,
    foods
  } = data;

  const combos = data.combos || null;

  if (combos && combos.length) {
    let intro = `Mình gợi ý một số combo phù hợp với ngân sách ${formatMoney(analysis.budget || 0)}:`;

    const lines = combos.slice(0, 10).map((c, idx) => {
      const titles = c.items.map(i => i.title).join(' + ');
      return `${idx + 1}. ${titles} — Tổng: ${formatMoney(c.total)}`;
    });

    return `${intro}\n\n${lines.join('\n')}\n\nBạn muốn xem chi tiết combo nào?`;
  }

  if (!foods.length) {
    if (analysis.maxPrice !== null) {
      return `Mình chưa tìm thấy món nào phù hợp với mức giá ${formatMoney(
        analysis.maxPrice
      )} trong Mini Food. Bạn thử mức giá khác nhé.`;
    }

    if (analysis.category) {
      return `Hiện tại mình chưa tìm thấy món thuộc danh mục "${analysis.category}" trong Mini Food.`;
    }

    if (analysis.ingredient) {
      return `Mình chưa tìm thấy món có liên quan đến "${analysis.ingredient}" trong dữ liệu Mini Food.`;
    }

    return "Mình chưa tìm thấy món phù hợp trong dữ liệu Mini Food.";
  }

  let intro = "Mình tìm được cho bạn:";

  if (analysis.sort === "price_asc") {
    intro = "Đây là các món được sắp xếp từ giá thấp đến cao:";
  }

  if (analysis.sort === "price_desc") {
    intro = "Đây là các món được sắp xếp từ giá cao đến thấp:";
  }

  if (analysis.maxPrice !== null) {
    intro += ` Các món có giá không quá ${formatMoney(
      analysis.maxPrice
    )}.`;
  }

  if (analysis.minPrice !== null) {
    intro += ` Giá từ ${formatMoney(
      analysis.minPrice
    )} trở lên.`;
  }

  if (analysis.category) {
    intro += ` Danh mục: ${analysis.category}.`;
  }

  const lines = foods.slice(0, 10).map((food, index) => {
    const rating =
      Number(food.avg_rating || 0) > 0
        ? ` ⭐ ${Number(food.avg_rating).toFixed(1)}`
        : "";

    return `${index + 1}. ${food.title} — ${formatMoney(
      food.price
    )}${rating}`;
  });

  return `${intro}\n\n${lines.join("\n")}\n\nBạn muốn mình lọc tiếp theo giá, danh mục hoặc nguyên liệu không?`;
}

async function askFoodAI(text) {
  const result = await findFoods(text);

  return {
    ...result,
    answer: buildAnswer(result)
  };
}

module.exports = {
  normalize,
  detectPrice,
  detectCategory,
  detectIngredient,
  detectFlavor,
  detectIntent,
  analyzeQuestion,
  findFoods,
  suggestCombos,
  fuzzySearch,
  suggestAlternatives,
  analyzeReviews,
  calculateCart,
  buildAnswer,
  askFoodAI
};