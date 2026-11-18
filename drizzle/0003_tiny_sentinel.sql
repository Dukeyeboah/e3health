ALTER TABLE `orders` ADD `stock_applied` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TRIGGER orders_stock_check BEFORE UPDATE OF stock_applied ON orders
WHEN NEW.stock_applied = 1 AND OLD.stock_applied = 0
BEGIN
 SELECT CASE WHEN EXISTS (
  SELECT 1 FROM json_each(NEW.data, '$.lines') AS line
  LEFT JOIN products AS product ON product.id = json_extract(line.value, '$.id')
  WHERE product.id IS NULL
   OR CAST(json_extract(product.data, '$.stock') AS INTEGER) < CAST(json_extract(line.value, '$.quantity') AS INTEGER)
   OR EXISTS (SELECT 1 FROM settings WHERE key = 'deleted-product:' || json_extract(line.value, '$.id'))
 ) THEN RAISE(ABORT, 'E3_INSUFFICIENT_STOCK') END;
END;
--> statement-breakpoint
CREATE TRIGGER orders_stock_deduct AFTER UPDATE OF stock_applied ON orders
WHEN NEW.stock_applied = 1 AND OLD.stock_applied = 0
BEGIN
 UPDATE products SET data = json_set(data, '$.stock', CAST(json_extract(data, '$.stock') AS INTEGER) -
  (SELECT CAST(json_extract(line.value, '$.quantity') AS INTEGER) FROM json_each(NEW.data, '$.lines') AS line WHERE json_extract(line.value, '$.id') = products.id))
 WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(NEW.data, '$.lines'));
END;
--> statement-breakpoint
CREATE TRIGGER orders_stock_restore AFTER UPDATE OF stock_applied ON orders
WHEN NEW.stock_applied = 0 AND OLD.stock_applied = 1
BEGIN
 UPDATE products SET data = json_set(data, '$.stock', CAST(json_extract(data, '$.stock') AS INTEGER) +
  (SELECT CAST(json_extract(line.value, '$.quantity') AS INTEGER) FROM json_each(OLD.data, '$.lines') AS line WHERE json_extract(line.value, '$.id') = products.id))
 WHERE id IN (SELECT json_extract(value, '$.id') FROM json_each(OLD.data, '$.lines'));
END;
