const db = require('../config/db');

(async () => {
  try {
    await db.ready();
    const [cats] = await db.query('SELECT id,name FROM categories');
    const map = {};
    for (const c of cats) map[c.name] = c.id;

    const samples = [
      ['Trà sữa trân châu', 'Trà sữa thơm béo, topping trân châu', 35000, 'Đồ uống'],
      ['Nước cam tươi', 'Nước cam ép tươi', 30000, 'Đồ uống'],
      ['Cà phê sữa đá', 'Cà phê phin pha sữa', 25000, 'Đồ uống'],
      ['Kem vani', 'Kem mát lạnh vị vani', 25000, 'Bánh kẹo'],
      ['Bánh flan', 'Bánh flan caramel mềm mịn', 20000, 'Bánh kẹo'],
      ['Bánh quy socola', 'Bánh quy giòn vị socola', 15000, 'Bánh kẹo']
    ];

    for (const s of samples) {
      const title = s[0];
      const [exists] = await db.query('SELECT COUNT(*) AS total FROM foods WHERE LOWER(title) = LOWER(?)', [title]);
      if (exists[0].total > 0) {
        console.log('Skip existing:', title);
        continue;
      }

      const category = s[3];
      let category_id = map[category];
      if (!category_id) {
        const [res] = await db.query('INSERT INTO categories (name) VALUES (?)', [category]);
        category_id = res.lastID || res.insertId || null;
        map[category] = category_id;
      }

      await db.query('INSERT INTO foods (title, description, price, category_id, image, gram, ingredients) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        s[0], s[1], s[2], category_id, '', 0, ''
      ]);

      console.log('Inserted:', title);
    }

    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
