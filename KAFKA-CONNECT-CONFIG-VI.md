# Giải Thích Cấu Hình Kafka Connect (Debezium)

Trong file `docker-compose.yml`, service `kafka-connect` có các tham số môi trường quan trọng sau:

## 1. Kết Nối Kafka

- **`BOOTSTRAP_SERVERS: kafka:9092`**
  - **Ý nghĩa**: Địa chỉ của Kafka broker mà Connect sẽ kết nối đến.
  - **Tại sao**: Để gửi CDC events vào Kafka và lưu trữ config/offset của chính nó.

- **`GROUP_ID: 1`**
  - **Ý nghĩa**: ID của consumer group cho Kafka Connect cluster.
  - **Tại sao**: Nếu bạn chạy nhiều node Kafka Connect (cluster mode), chúng cần cùng Group ID để phối hợp làm việc.

## 2. Lưu Trữ Trạng Thái (Internal Topics)

Kafka Connect cần 3 topics nội bộ để lưu trạng thái hoạt động. Nó không dùng database, mà dùng chính Kafka.

- **`CONFIG_STORAGE_TOPIC: connect_configs`**
  - **Ý nghĩa**: Lưu cấu hình của các connectors (ví dụ: thông tin kết nối Postgres, table whitelist...).
  - **Quan trọng**: Nếu mất topic này, bạn mất hết cấu hình connector.

- **`OFFSET_STORAGE_TOPIC: connect_offsets`**
  - **Ý nghĩa**: Lưu vị trí (offset) hiện tại mà connector đã đọc đến.
  - **Ví dụ**: "Đã đọc đến LSN 0/1A2B3C trong Postgres WAL".
  - **Tại sao**: Giúp connector tiếp tục chạy từ điểm dừng khi bị restart, không bị mất dữ liệu hay đọc lại từ đầu.

- **`STATUS_STORAGE_TOPIC: connect_statuses`**
  - **Ý nghĩa**: Lưu trạng thái hiện tại của connector và tasks (RUNNING, PAUSED, FAILED).

## 3. Định Dạng Dữ Liệu (Converters)

Cấu hình cách dữ liệu được serialize khi ghi vào Kafka.

- **`KEY_CONVERTER: org.apache.kafka.connect.json.JsonConverter`**
  - **Ý nghĩa**: Key của message Kafka sẽ là JSON.
  - **Ví dụ**: `{"order_id": "123"}`

- **`VALUE_CONVERTER: org.apache.kafka.connect.json.JsonConverter`**
  - **Ý nghĩa**: Value (nội dung) của message Kafka sẽ là JSON.
  - **Ví dụ**: `{"before": null, "after": {...}, "op": "c"}`

- **`CONNECT_KEY_CONVERTER_SCHEMAS_ENABLE: "false"`**
- **`CONNECT_VALUE_CONVERTER_SCHEMAS_ENABLE: "false"`**
  - **Ý nghĩa**: Không kèm theo schema trong mỗi message JSON.
  - **Tại sao**: 
    - `true`: Message rất nặng vì lặp lại schema (tên cột, kiểu dữ liệu) trong MỌI message.
    - `false`: Chỉ gửi dữ liệu thuần, nhẹ hơn nhiều, dễ đọc hơn (như JSON thường).
    - **Lưu ý**: Nếu dùng `false`, consumer phải tự biết cấu trúc dữ liệu (như cách chúng ta làm trong `clickhouse-bridge`).

## Tóm Tắt

```yaml
environment:
  # Kết nối
  BOOTSTRAP_SERVERS: kafka:9092
  GROUP_ID: 1
  
  # Lưu trạng thái (QUAN TRỌNG)
  CONFIG_STORAGE_TOPIC: connect_configs
  OFFSET_STORAGE_TOPIC: connect_offsets
  STATUS_STORAGE_TOPIC: connect_statuses
  
  # Định dạng JSON gọn nhẹ (không schema)
  KEY_CONVERTER: org.apache.kafka.connect.json.JsonConverter
  VALUE_CONVERTER: org.apache.kafka.connect.json.JsonConverter
  CONNECT_KEY_CONVERTER_SCHEMAS_ENABLE: "false"
  CONNECT_VALUE_CONVERTER_SCHEMAS_ENABLE: "false"
```
