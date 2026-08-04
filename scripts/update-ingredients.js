const db = require('../config/db');

function normalizeText(text) {
  return String(text || "")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

(async () => {
  try {
    await db.ready();
    const [rows] = await db.query('SELECT id, title, ingredients FROM foods');
    for (const r of rows) {
      if (!r.ingredients || String(r.ingredients).trim() === '') {
        const ing = normalizeText(r.title || '');
        await db.query('UPDATE foods SET ingredients = ? WHERE id = ?', [ing, r.id]);
        console.log('Updated ingredients for', r.id, r.title);
      }
    }
    console.log('Done updating ingredients');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
