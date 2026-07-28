PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    fullname TEXT DEFAULT '',
    balance REAL NOT NULL DEFAULT 0
  );
INSERT INTO users VALUES(1,'admin','$2b$10$FUmFnUGf4xXB.KtlZXowqerUVHJMlLBASY5TtuWwK1zmNyhULkfgK','',6999820000.0);
INSERT INTO users VALUES(2,'24100503','$2b$10$8XWxsjQEUFwDze8R3Y9dBexnlDbIR.w0pFMG7bcbyLk/zWREsb8SG','nguyễn đức',30000000000.0);
INSERT INTO users VALUES(3,'duc','$2b$10$Mutj4CeZOSC1ydJ2F9GUXunbzjUtqcfhWwhl/U01d0iBOyMQ7Hn3W','',20000000.0);
CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  , author TEXT DEFAULT 'Admin');
INSERT INTO posts VALUES(1,'Tiêu đề  5 Xu Hướng Ẩm Thực Được Yêu Thích Nhất Năm 2026',replace(replace('        Trong năm 2026, ngành ẩm thực tiếp tục phát triển mạnh mẽ với nhiều xu hướng mới nhằm mang đến trải nghiệm tốt hơn cho khách hàng. Không chỉ chú trọng đến hương vị, các nhà hàng còn đầu tư vào chất lượng nguyên liệu, cách trình bày món ăn và dịch vụ giao hàng nhanh chóng.\r\n\r\nBurger phô mai, pizza hải sản, gà rán Hàn Quốc và các món ăn tốt cho sức khỏe đang trở thành những lựa chọn được nhiều người yêu thích. Bên cạnh đó, các loại đồ uống như trà đào cam sả, trà sữa và nước ép trái cây cũng ngày càng được ưa chuộng.\r\n\r\nMini Food luôn cập nhật thực đơn mới mỗi tuần để mang đến nhiều sự lựa chọn hấp dẫn. Chúng tôi cam kết sử dụng nguyên liệu tươi sạch, đảm bảo vệ sinh an toàn thực phẩm và mang đến trải nghiệm đặt món nhanh chóng, tiện lợi.','\r',char(13)),'\n',char(10)),'2026-07-11 17:30:47','Admin');
CREATE TABLE addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    label TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    district TEXT NOT NULL,
    ward TEXT NOT NULL,
    street TEXT NOT NULL,
    detail_address TEXT NOT NULL,
    note TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT INTO addresses VALUES(1,3,'duc','nhà riêng','đức','0998932589','Hà nội','h','j','j','ók','',1,'2026-06-25 01:29:21','2026-06-25 01:29:21');
INSERT INTO addresses VALUES(2,1,'admin','Nhà','3tl','0890823958','Hà Nôi','Hà đông','yên nghĩa','Yên nghĩa','thôn','ss',1,'2026-07-08 16:02:03','2026-07-08 16:02:03');
CREATE TABLE delivery_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    fee REAL NOT NULL DEFAULT 0
  );
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
INSERT INTO categories VALUES(1,'Đồ tươi sống');
INSERT INTO categories VALUES(2,'Rau củ');
INSERT INTO categories VALUES(3,'Trái cây');
INSERT INTO categories VALUES(4,'Hải sản');
INSERT INTO categories VALUES(5,'Gạo - Mì');
INSERT INTO categories VALUES(6,'Sữa và sản phẩm từ sữa');
INSERT INTO categories VALUES(7,'Thực phẩm đông lạnh');
INSERT INTO categories VALUES(8,'Thực phẩm khô');
INSERT INTO categories VALUES(9,'Gia vị');
INSERT INTO categories VALUES(10,'Đồ uống');
INSERT INTO categories VALUES(11,'Bánh kẹo');
INSERT INTO categories VALUES(12,'Bánh mì');
INSERT INTO categories VALUES(13,'Đồ gia dụng');
INSERT INTO categories VALUES(14,'Pizza');
CREATE TABLE foods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    category_id INTEGER,
    image TEXT
  , gram INTEGER NOT NULL DEFAULT 0);
INSERT INTO foods VALUES(10,'Pizza Hải Sản            ',replace(replace('              Ngon\r\n\r\n            ','\r',char(13)),'\n',char(10)),100000.0,14,'https://i.ibb.co/zHT3mrKC/Screenshot-2026-06-25-233148.png            ',100);
INSERT INTO foods VALUES(11,'Pizza nhân thịt thập cẩm            ',replace(replace('              Ngon\r\n            ','\r',char(13)),'\n',char(10)),140000.0,14,'https://i.ibb.co/tT6FpWds/Screenshot-2026-06-25-233410.png            ',100);
INSERT INTO foods VALUES(12,'Pizza vị truyền thống                         ',replace(replace('                            Pizza Hawaii mang đến hương vị mùa hè tươi mát từ vị dứa (thơm) đặc trưng cùng thịt dăm bông mặn và xốt cà chua, phô mai thơm béo ấn tượng.\r\n\r\n\r\n            \r\n            ','\r',char(13)),'\n',char(10)),150000.0,14,'https://i.ibb.co/dw6PFk2w/Screenshot-2026-06-25-233725.png                        ',100);
INSERT INTO foods VALUES(13,'Pizza thanh đạm             ',replace(replace('              Sự tươi ngon, bổ dưỡng của các loại rau củ vẫn được giữ trọn vẹn trong từng chiếc bánh pizza rau củ thập cẩm.\r\n            ','\r',char(13)),'\n',char(10)),120000.0,14,'https://i.ibb.co/ns8Q6wrM/Screenshot-2026-06-25-234151.png            ',100);
INSERT INTO foods VALUES(14,'Pizza dành cho bé            ',replace(replace('              Chiếc pizza kết hợp hương vị từ những nguyên liệu bé nào cũng thích như thịt gà, thịt heo xông khói cùng xốt phô mai béo ngậy, thơm lừng.\r\n\r\n\r\n            ','\r',char(13)),'\n',char(10)),90000.0,14,'https://i.ibb.co/4wNvDxs3/Screenshot-2026-06-25-234347.png            ',100);
INSERT INTO foods VALUES(15,'Thịt thăn','Thịt thăn hay còn gọi là nạc thăn, là phần thịt nạc không chứa bất kì lớp mỡ nào.',60000.0,1,'https://i.ibb.co/2pBbZZT/Screenshot-2026-06-25-235054.png',0);
INSERT INTO foods VALUES(17,'Rau Má            ',replace(replace('              Thanh Hóa\r\n            ','\r',char(13)),'\n',char(10)),40000.0,2,'https://i.ibb.co/Nd0jCg88/Screenshot-2026-07-08-225842.png            ',20);
INSERT INTO foods VALUES(18,'Rau mùi            ',replace(replace('              Rau mùi\r\n            ','\r',char(13)),'\n',char(10)),20000.0,2,'https://i.ibb.co/pBhjX5V1/Screenshot-2026-07-08-230011.png            ',300);
INSERT INTO foods VALUES(25,'Cá Chép sông             ',replace(replace('              Cá chép là cá sông ở nước ngọt giàu chất dinh dưỡng.\r\n            ','\r',char(13)),'\n',char(10)),70000.0,1,'https://suckhoedoisong.qltns.mediacdn.vn/324455921873985536/2026/5/17/ca-chep-giau-protein-17790253258581292916915.png',4000);
INSERT INTO foods VALUES(26,'Thịt gà ta nguyên con','Thịt gà Ta món ăn ưa thích của đa số người dân Việt Nam ',440000.0,1,'https://monngonmoingay.com/wp-content/uploads/2024/10/Cach-don-gian-de-chon-mua-duoc-thit-ga-tuoi-ngon-MNMN-1.jpg',3500);
INSERT INTO foods VALUES(27,'Ức Gà ','Ức gà món ăn ưa thích của ae tập gym , người đang giảm cân ',80000.0,1,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT63r6qFYZSeFFnHjAaGj3HBS-gKk7TUJdvXVe3xcbA2g&s=10',1000);
INSERT INTO foods VALUES(28,'Chim Cút làm sạch ','Thịt chim cút: Thịt chắc, thơm, có vị ngọt tự nhiên và chứa nhiều protein nhưng lại ít chất béo xấu. Món ăn từ thịt cút vô cùng đa dạng, từ dân dã như chim cút chiên bơ, nướng mật ong cho đến các món bổ dưỡng như chim cút hầm thuốc bắc, hầm hạt sen.',50000.0,1,'https://nongsandungha.com/wp-content/uploads/2022/03/chim-cut-chien-xa-ot1-500x374.jpg',500);
INSERT INTO foods VALUES(29,'Cua Đồng Sống','Cua đồng: Món quà bình dị của đồng ruộng Việt Nam. Con cua đồng tuy nhỏ nhưng là linh hồn của những món ăn giải nhiệt ngày hè như canh cua mồng tơi, bún riêu cua hay lẩu riêu cua bắp bò. Nước dùng ngọt lịm từ thịt cua giã nhuyễn cùng lớp gạch cua béo ngậy luôn có sức hấp dẫn khó cưỡng đối với bất kỳ ai.',30000.0,1,'https://nongsandungha.com/wp-content/uploads/2021/06/lau-cua-dong-ngon-ngot-chuan-vi-que-nha-lau-cua-dong-1-1559809331-893-width455height462.jpg',1000);
INSERT INTO foods VALUES(30,'Cà Chua Bi ','Cà chua là loại quả quen thuộc trong căn bếp của mọi gia đình, được ví như một "nhà máy dinh dưỡng" nhờ màu đỏ đặc trưng và những lợi ích tuyệt vời cho sức khỏe. Dù trong thực vật học, cà chua là một loại trái cây, nhưng trong ẩm thực, nó lại được sử dụng như một loại rau củ đa năng.',15000.0,2,'https://nongsandungha.com/wp-content/uploads/2024/08/dia-chi-mua-ca-chua-bi.jpg',1000);
INSERT INTO foods VALUES(31,'Rau cài ngồng','Cải ngồng (hay còn gọi là cải ngồng xanh) là một trong những loại rau thuộc họ thập tự được yêu thích nhất nhờ vị ngọt đậm đà, giòn sần sật và vẻ ngoài rất đặc trưng. Điểm độc biệt của loại cải này là khi phát triển đến độ ngon nhất, rau sẽ mọc ra một chiếc ngồng (phần thân non) ở chính giữa, trên đỉnh có những búp hoa màu vàng tươi nhỏ li ti.',5000.0,2,'https://vinhhaphuxuyen.vn/wp-content/uploads/2018/03/Cai-ngong.jpg',300);
INSERT INTO foods VALUES(32,'Cam ngọt','Quả cam là một trong những loại trái cây thuộc họ cam chanh (rutaceae) phổ biến và được yêu thích nhất trên toàn thế giới. Với hương vị chua ngọt thanh mát, mọng nước và hương thơm tự nhiên dễ chịu, quả cam không chỉ là một món ăn tráng miệng tuyệt vời mà còn là biểu tượng của nguồn năng lượng lành mạnh.',112000.0,3,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTdmz6ztrRNRabOcnwd4NHE1xR22GVczaYlc287EF7kBg&s=10',2000);
INSERT INTO foods VALUES(33,'Cua Hoàng Đế','Cua Hoàng Đế (King Crab) được mệnh danh là "vua của các loại cua" và là một trong những món hải sản xa xỉ, thượng hạng bậc nhất thế giới. Chúng sinh sống ở những vùng biển băng giá, có độ sâu lớn và điều kiện khí hậu vô cùng khắc nghiệt như vùng biển Bering giữa Alaska (Mỹ) và Nga, hay vùng biển phía Bắc Thái Bình Dương.',2500000.0,4,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTN5Mz2HrD0uoA2V-l35dBBzHegGeYd9BHjZZhUDzGwCKeVDLAUuc5fzjM&s=10',2500);
INSERT INTO foods VALUES(34,'Hàu Sống ','Hàu (hay còn gọi là hào) là loại động vật nhuyễn thể hai mảnh vỏ, sinh sống chủ yếu ở các vùng vịnh, cửa sông hoặc bờ biển nơi có dòng nước lưu thông tốt. Được mệnh danh là "sữa của biển khơi", hàu không chỉ là một món hải sản ngon miệng mà còn là nguồn dinh dưỡng cực kỳ quý giá cho sức khỏe.',90000.0,4,'https://bizweb.dktcdn.net/100/417/051/products/b210b548a20c715932a487e8b7c13db1.jpg?v=1612145649457',1000);
INSERT INTO foods VALUES(35,'Sữa tươi VinaMILK','Vinamilk là thương hiệu sữa hàng đầu Việt Nam, được nhiều gia đình tin dùng nhờ chất lượng cao và nguồn dinh dưỡng cân đối. Sản phẩm được sản xuất từ nguồn sữa tươi đạt chuẩn, mang đến hương vị thơm ngon và bổ sung các dưỡng chất cần thiết cho cơ thể.',30000.0,6,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSvVLmwGIJcOKjDAu5Cgb3LY3dbfuhOeID8tVmBrWmzFA&s=10',1000);
INSERT INTO foods VALUES(36,'Mì Chũ ','Mì Chũ là đặc sản nổi tiếng của tỉnh Bắc Giang, được làm từ gạo bao thai hồng chất lượng cao theo phương pháp thủ công truyền thống. Sợi mì dai, thơm, không bị nát khi chế biến và phù hợp với nhiều món ăn như mì nước, mì xào hay lẩu.',50000.0,8,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSOI7B5X5mBir3lC2pe47YfDCC3aM8XH3IKj776sJIbUw&s=10',5000);
INSERT INTO foods VALUES(37,'Mì Hảo Hảo ','Mì Hảo Hảo là một trong những thương hiệu mì ăn liền được yêu thích nhất tại Việt Nam với hương vị thơm ngon, sợi mì dai và nước súp đậm đà. Được sản xuất trên dây chuyền hiện đại, Mì Hảo Hảo mang đến bữa ăn nhanh chóng, tiện lợi nhưng vẫn đảm bảo chất lượng và hương vị hấp dẫn.',115000.0,8,'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQVEkbsPDS7QfH0B0tPKn2zq9GEnB61cFSrdOpzwCy_gQ&s=10',70000);
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    food_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 5,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
CREATE TABLE orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    total REAL,
    payment_method TEXT,
    status TEXT,
    delivery_company TEXT,
    delivery_address TEXT,
    shipping_fee REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT INTO orders VALUES(1,'duc',160000.0,'COD','Hoàn thành','Giao hàng tiêu chuẩn','đức — ók, j, j, h, Hà nội',0.0,'2026-06-25 01:33:22');
INSERT INTO orders VALUES(2,'duc',60000.0,'COD','Đã hủy','Giao hàng tiêu chuẩn','đức — ók, j, j, h, Hà nội',0.0,'2026-07-06 18:37:23');
INSERT INTO orders VALUES(3,'admin',20000.0,'COD','Hoàn thành','Giao hàng tiêu chuẩn','3tl — thôn, Yên nghĩa, yên nghĩa, Hà đông, Hà Nôi',0.0,'2026-07-08 16:02:15');
INSERT INTO orders VALUES(4,'admin',100000.0,'wallet','Đã thanh toán bằng ví','Giao hàng tiêu chuẩn','3tl — thôn, Yên nghĩa, yên nghĩa, Hà đông, Hà Nôi',0.0,'2026-07-11 16:07:18');
INSERT INTO orders VALUES(5,'admin',80000.0,'wallet','Đã xác nhận','Giao hàng tiêu chuẩn','3tl — thôn, Yên nghĩa, yên nghĩa, Hà đông, Hà Nôi',0.0,'2026-07-11 16:16:41');
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    food_id INTEGER,
    title TEXT,
    price REAL,
    quantity INTEGER
  );
INSERT INTO order_items VALUES(1,1,5,'Thịt Heo',80000.0,2);
INSERT INTO order_items VALUES(2,2,15,'Thịt thăn',60000.0,1);
INSERT INTO order_items VALUES(3,3,18,'Rau mùi',20000.0,1);
INSERT INTO order_items VALUES(4,4,18,replace(replace('Rau mùi\r\n                ','\r',char(13)),'\n',char(10)),20000.0,5);
INSERT INTO order_items VALUES(5,5,18,replace(replace('Rau mùi\r\n                ','\r',char(13)),'\n',char(10)),20000.0,4);
CREATE TABLE promotions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
INSERT INTO promotions VALUES(4,'☀️ HÈ RỰC RỠ – GIÁ "RỤNG" KHÔNG PHANH! 😆','Trời thì nóng, nhưng giá thì mát! Săn ngay ưu đãi lên đến 50%, freeship và hàng ngàn deal ngon đang chờ bạn. Chậm một chút là người khác "hốt" mất đấy!','2026-07-17 14:45:15');
INSERT INTO promotions VALUES(5,'💸 Lương chưa về, ngại giá cả? Đừng lo, ĐK FOOD lo! 🍔',replace(replace('Ưu đãi mùa hè lên đến 50%, freeship đơn từ 199.000đ cùng hàng trăm món ăn hấp dẫn đang chờ bạn. Săn deal ngay hôm nay để ăn ngon mà không lo "đau ví"!\r\n\r\nCâu "Lương chưa về, ngại giá cả? Đừng lo, ĐK FOOD lo!" rất dễ nhớ, có vần và phù hợp để làm slogan cho chương trình khuyến mãi. Chỉ cần thêm dấu câu như trên sẽ tự nhiên và chuyên nghiệp hơn.','\r',char(13)),'\n',char(10)),'2026-07-17 14:51:45');
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('users',3);
INSERT INTO sqlite_sequence VALUES('foods',37);
INSERT INTO sqlite_sequence VALUES('addresses',2);
INSERT INTO sqlite_sequence VALUES('orders',5);
INSERT INTO sqlite_sequence VALUES('order_items',5);
INSERT INTO sqlite_sequence VALUES('categories',14);
INSERT INTO sqlite_sequence VALUES('posts',1);
INSERT INTO sqlite_sequence VALUES('promotions',5);
COMMIT;
