const foodModel = require("../models/foodModel");

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

  return {
    original: text,
    normalized,

    intent: detectIntent(normalized),

    category: detectCategory(normalized),

    ingredient: detectIngredient(normalized),

    flavor: detectFlavor(normalized),

    minPrice: price.minPrice,

    maxPrice: price.maxPrice,

    sort: price.sort
  };
}

/* =================================
   TÌM MÓN
================================= */

async function findFoods(text) {
  const analysis = analyzeQuestion(text);

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

  return {
    analysis,
    foods
  };
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
  buildAnswer,
  askFoodAI
};