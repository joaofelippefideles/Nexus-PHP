-- ==========================================================================
-- NEXUS TECH — Seed do banco de dados (dados de demonstração)
-- Migra os 12 produtos de assets/js/data/products.js para o banco:
--   - 1 marca (Nexus)
--   - 10 categorias
--   - 12 produtos (preços em CENTAVOS)
--   - 12 imagens (product_images)
--   - 48 especificações (product_specs, EAV — 4 por produto)
--   - 12 registros de estoque (inventory; Monitor e Carregador = 0 = esgotados)
--
-- USO:  mysql -u root -p < seed.sql   (rodar DEPOIS do schema.sql)
-- ==========================================================================

USE nexus_tech_db;

/* -------------------------------------------------------------------------- */
/* Marca                                                                       */
/* -------------------------------------------------------------------------- */
INSERT INTO brands (name, slug) VALUES
  ('Nexus', 'nexus');

/* -------------------------------------------------------------------------- */
/* Categorias                                                                  */
/* -------------------------------------------------------------------------- */
INSERT INTO categories (name, slug) VALUES
  ('Notebooks',   'notebooks'),
  ('Monitores',   'monitores'),
  ('Teclados',    'teclados'),
  ('Headsets',    'headsets'),
  ('Celulares',   'celulares'),
  ('Mouses',      'mouses'),
  ('Acessórios',  'acessorios'),
  ('Games',       'games'),
  ('Áudio',       'audio'),
  ('Tablets',     'tablets');

/* -------------------------------------------------------------------------- */
/* Produtos                                                                    */
/* brand_id = 1 (Nexus) | category_id conforme o slug da categoria            */
/* -------------------------------------------------------------------------- */
INSERT INTO products
  (slug, name, description, brand_id, category_id, price_cents, old_price_cents,
   rating, rating_count, is_featured, is_new, is_bestseller) VALUES
  ('notebook-nexus-a15', 'Notebook Nexus A15',
   'Notebook com processador de última geração, ideal para estudos, trabalho e tarefas do dia a dia.',
   1, 1, 399990, 459990, 4.6, 128, 1, 0, 0),
  ('notebook-nexus-ultra-pro', 'Notebook Nexus Ultra Pro',
   'Performance máxima para criação de conteúdo, games e programação pesada.',
   1, 1, 719990, 799990, 4.9, 421, 1, 1, 0),
  ('monitor-nexus-27-qhd', 'Monitor Nexus 27" QHD',
   'Imagem nítida em 2K com alta taxa de atualização, perfeito para trabalho e games.',
   1, 2, 104990, 129990, 4.4, 86, 1, 0, 0),
  ('teclado-mecanico-nexus-rgb', 'Teclado Mecânico Nexus RGB',
   'Switches mecânicos com iluminação RGB personalizável e teclas em português.',
   1, 3, 39990, 49990, 4.8, 312, 1, 0, 0),
  ('headset-gamer-nexus-pro', 'Headset Gamer Nexus Pro',
   'Som surround imersivo, microfone removível e conforto para longas sessões de jogo.',
   1, 4, 29990, NULL, 4.9, 540, 1, 0, 1),
  ('celular-nexus-x20', 'Celular Nexus X20',
   'Câmera versátil, tela imersiva e bateria de longa duração para o dia inteiro.',
   1, 5, 249990, 299990, 4.5, 920, 1, 0, 1),
  ('mouse-gamer-nexus-m1', 'Mouse Gamer Nexus M1',
   'Sensor de alta precisão, leve e com botões programáveis para domínio total no game.',
   1, 6, 14990, NULL, 4.7, 780, 0, 1, 1),
  ('webcam-nexus-hd', 'Webcam Nexus HD 1080p',
   'Vídeo em Full HD com foco automático e microfone integrado para chamadas e lives.',
   1, 7, 19990, 25990, 4.3, 154, 0, 0, 0),
  ('console-nexus-game-s', 'Console Nexus Game S',
   'Console de nova geração com carregamento rápido e catálogo exclusivo de jogos.',
   1, 8, 349990, 399990, 4.8, 266, 0, 1, 0),
  ('som-nexus-bt-go', 'Caixa de Som Nexus BT Go',
   'Compacta, resistente à água e com som potente para levar onde quiser.',
   1, 9, 12990, 16990, 4.2, 138, 0, 0, 0),
  ('carregador-rapido-nexus-65w', 'Carregador Rápido Nexus 65W',
   'Carregue notebook, celular e tablet rapidamente com tecnologia GaN de alta eficiência.',
   1, 7, 15990, NULL, 4.6, 209, 0, 0, 0),
  ('tablet-nexus-tab10', 'Tablet Nexus Tab 10',
   'Tela de 10 polegadas, ideal para leitura, estudos e entretenimento no sofá.',
   1, 10, 139990, 169990, 4.4, 97, 0, 0, 0);

/* -------------------------------------------------------------------------- */
/* Imagens (1 por produto; url = nome do arquivo do SVG original)             */
/* Os ids dos produtos assumem a ordem de inserção acima (1..12).             */
/* -------------------------------------------------------------------------- */
INSERT INTO product_images (product_id, url, alt, position) VALUES
  (1,  'notebook-a15.svg',    'Notebook Nexus A15',            0),
  (2,  'notebook-ultra.svg',  'Notebook Nexus Ultra Pro',      0),
  (3,  'monitor-27.svg',      'Monitor Nexus 27" QHD',         0),
  (4,  'teclado-rgb.svg',     'Teclado Mecânico Nexus RGB',    0),
  (5,  'headset-pro.svg',     'Headset Gamer Nexus Pro',       0),
  (6,  'celular-x20.svg',     'Celular Nexus X20',             0),
  (7,  'mouse-m1.svg',        'Mouse Gamer Nexus M1',          0),
  (8,  'webcam-hd.svg',       'Webcam Nexus HD 1080p',         0),
  (9,  'console-s.svg',       'Console Nexus Game S',          0),
  (10, 'som-bt.svg',          'Caixa de Som Nexus BT Go',      0),
  (11, 'carregador-65w.svg',  'Carregador Rápido Nexus 65W',   0),
  (12, 'tablet-tab10.svg',    'Tablet Nexus Tab 10',           0);

/* -------------------------------------------------------------------------- */
/* Especificações (EAV: label/value por produto)                              */
/* -------------------------------------------------------------------------- */
INSERT INTO product_specs (product_id, label, value, position) VALUES
  /* 1 — Notebook A15 */
  (1, 'Processador',     'Ryzen 7',                0),
  (1, 'Memória RAM',     '16 GB',                  1),
  (1, 'Armazenamento',   'SSD 512 GB',             2),
  (1, 'Tela',            '15.6" Full HD',          3),
  /* 2 — Notebook Ultra Pro */
  (2, 'Processador',     'Core i9',                0),
  (2, 'Memória RAM',     '32 GB',                  1),
  (2, 'Armazenamento',   'SSD 1 TB',               2),
  (2, 'Tela',            '16" 2K',                 3),
  /* 3 — Monitor 27" QHD */
  (3, 'Tamanho',         '27 polegadas',           0),
  (3, 'Resolução',       'QHD 2K',                 1),
  (3, 'Taxa',            '165 Hz',                 2),
  (3, 'Painel',          'IPS',                    3),
  /* 4 — Teclado Mecânico RGB */
  (4, 'Tipo',            'Mecânico',               0),
  (4, 'Layout',          'ABNT2',                  1),
  (4, 'Iluminação',      'RGB',                    2),
  (4, 'Conectividade',   'USB-C',                  3),
  /* 5 — Headset Gamer Pro */
  (5, 'Tipo',            'Headset gamer',          0),
  (5, 'Microfone',       'Removível',              1),
  (5, 'Conectividade',   'USB/P3',                 2),
  (5, 'Som',             'Surround 7.1',           3),
  /* 6 — Celular X20 */
  (6, 'Tela',            '6.5" OLED',              0),
  (6, 'Câmera',          '108 MP',                 1),
  (6, 'Bateria',         '5.000 mAh',              2),
  (6, 'Memória',         '256 GB',                 3),
  /* 7 — Mouse M1 */
  (7, 'Sensor',          '16.000 DPI',             0),
  (7, 'Peso',            '69 g',                   1),
  (7, 'Botões',          '6 programáveis',         2),
  (7, 'Iluminação',      'RGB',                    3),
  /* 8 — Webcam HD */
  (8, 'Resolução',       '1080p',                  0),
  (8, 'Microfone',       'Integrado',              1),
  (8, 'Foco',            'Automático',             2),
  (8, 'Conectividade',   'USB',                    3),
  /* 9 — Console Game S */
  (9, 'Armazenamento',   'SSD 1 TB',               0),
  (9, 'Resolução',       '4K',                     1),
  (9, 'Controle',        'Sem fio',                2),
  (9, 'Gráficos',        'Ray tracing',            3),
  /* 10 — Caixa de Som BT Go */
  (10, 'Potência',       '20 W',                   0),
  (10, 'Bluetooth',      '5.3',                    1),
  (10, 'Proteção',       'IPX7',                   2),
  (10, 'Bateria',        '12 h',                   3),
  /* 11 — Carregador 65W */
  (11, 'Potência',       '65 W',                   0),
  (11, 'Tecnologia',     'GaN',                    1),
  (11, 'Portas',         '2x USB-C',               2),
  (11, 'Compatível',     'Notebook/Celular',       3),
  /* 12 — Tablet Tab 10 */
  (12, 'Tela',           '10.4"',                  0),
  (12, 'Memória',        '128 GB',                 1),
  (12, 'Sistema',        'Android',                2),
  (12, 'Bateria',        '8.000 mAh',              3);

/* -------------------------------------------------------------------------- */
/* Estoque (quantity = stock original; 0 = esgotado)                          */
/* -------------------------------------------------------------------------- */
INSERT INTO inventory (product_id, quantity) VALUES
  (1,  24),
  (2,  12),
  (3,  0),   -- Monitor: esgotado
  (4,  57),
  (5,  33),
  (6,  41),
  (7,  88),
  (8,  19),
  (9,  9),
  (10, 62),
  (11, 0),   -- Carregador: esgotado
  (12, 28);
