# Quy Tắc Đặt Tên Topic Của Debezium

Câu hỏi: *Làm sao biết tên topic là `orderserver.public.users` và `orderserver.public.orders`?*

Trả lời: Tên topic được Debezium tự động tạo ra theo công thức chuẩn:

```
[topic.prefix] . [schema] . [table]
```

## Giải Thích Chi Tiết

### 1. `topic.prefix`: "orderserver"
- **Nguồn**: Được cấu hình trong file `debezium/connector-config.json`.
- **Config**: `"topic.prefix": "orderserver"`
- **Ý nghĩa**: Đây là namespace cho toàn bộ database server này. Giúp phân biệt nếu bạn có nhiều database server khác nhau cùng đẩy vào một Kafka cluster.

### 2. `schema`: "public"
- **Nguồn**: Schema mặc định của PostgreSQL.
- **Ý nghĩa**: Tên schema chứa bảng dữ liệu. Trong Postgres, mặc định bảng nằm trong schema `public`.

### 3. `table`: "users" / "orders"
- **Nguồn**: Tên bảng thực tế trong Database.
- **Ý nghĩa**: Tên của bảng dữ liệu đang được theo dõi.

## Kết Quả

Ghép lại chúng ta có:

1. **Bảng Users**:
   - Prefix: `orderserver`
   - Schema: `public`
   - Table: `users`
   - **Topic Kafka**: `orderserver.public.users`

2. **Bảng Orders**:
   - Prefix: `orderserver`
   - Schema: `public`
   - Table: `orders`
   - **Topic Kafka**: `orderserver.public.orders`

## Kiểm Tra Cấu Hình

Bạn có thể xem file `debezium/connector-config.json` để thấy cấu hình này:

```json
{
    "name": "postgres-orders-connector",
    "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "topic.prefix": "orderserver",  <-- ĐÂY LÀ PREFIX
        "table.include.list": "public.orders,public.users",
        ...
    }
}
```

## Lưu Ý Quan Trọng

Nếu bạn đổi `"topic.prefix": "my-app"` trong config, thì tên topic sẽ đổi thành:
- `my-app.public.users`
- `my-app.public.orders`

Vì vậy, code trong `clickhouse-bridge/index.js` phải khớp với cấu hình này!
