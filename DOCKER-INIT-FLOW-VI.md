# Luồng Khởi Động & Vai Trò Services (Docker Compose)

Dưới đây là biểu đồ luồng khởi động (Initialization Flow) và giải thích vai trò chi tiết của từng container trong hệ thống.

## 1. Biểu Đồ Luồng Khởi Động (Startup Flow)

Hệ thống khởi động theo thứ tự phụ thuộc (dependencies) được định nghĩa trong `docker-compose.yml`.

```mermaid
graph TD
    %% Level 1: Base Services
    ZK[zookeeper] -->|Ready| KAFKA[kafka]
    PG[postgres] -->|Ready| BACKEND[backend]
    PG -->|Ready| KC[kafka-connect]
    
    %% Level 2: Middleware
    KAFKA -->|Ready| KC
    KAFKA -->|Ready| BRIDGE[clickhouse-bridge]
    
    %% Level 3: Application & Integration
    KC -->|Ready| BRIDGE
    KC -->|Ready| REG[connector-registrar]
    BACKEND -->|Ready| FE[frontend]

    %% Styling
    classDef base fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef middle fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    classDef app fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;

    class ZK,PG base;
    class KAFKA,KC,REG middle;
    class BACKEND,FE,BRIDGE app;
```

### Giải Thích Thứ Tự:

1.  **Tầng 1 (Cơ sở)**: `zookeeper` và `postgres` khởi động đầu tiên vì chúng không phụ thuộc ai.
2.  **Tầng 2 (Middleware)**:
    *   `kafka` khởi động sau khi `zookeeper` sẵn sàng.
    *   `backend` khởi động sau khi `postgres` sẵn sàng.
3.  **Tầng 3 (Integration)**:
    *   `kafka-connect` khởi động sau khi cả `kafka` và `postgres` đều sẵn sàng.
4.  **Tầng 4 (Ứng dụng & Bridge)**:
    *   `clickhouse-bridge` khởi động sau khi `kafka-connect` sẵn sàng.
    *   `connector-registrar` chạy script đăng ký sau khi `kafka-connect` sẵn sàng.
    *   `frontend` khởi động sau cùng (hoặc song song) khi `backend` đã chạy.

---

## 2. Vai Trò Chi Tiết Từng Container

| Container | Vai Trò Chính | Nhiệm Vụ Cụ Thể |
|-----------|---------------|-----------------|
| **`postgres`** | **Source Database** | • Lưu trữ dữ liệu chính (`orders`, `users`).<br>• Ghi Write-Ahead Log (WAL) để Debezium đọc.<br>• Nơi Backend ghi dữ liệu vào. |
| **`zookeeper`** | **Coordinator** | • Quản lý trạng thái của Kafka Cluster.<br>• Lưu metadata về topics, partitions. |
| **`kafka`** | **Message Broker** | • Trung chuyển dữ liệu.<br>• Lưu trữ các CDC events từ Debezium.<br>• Nơi `clickhouse-bridge` đọc dữ liệu. |
| **`kafka-connect`** | **CDC Runtime** | • Môi trường chạy Debezium Connector.<br>• Kết nối tới Postgres để đọc WAL.<br>• Chuyển đổi WAL thành JSON events và gửi vào Kafka. |
| **`connector-registrar`** | **Setup Tool** | • Container ngắn hạn (ephemeral).<br>• Chờ Kafka Connect sẵn sàng rồi chạy script `curl` để đăng ký cấu hình connector.<br>• Giúp tự động hóa việc setup. |
| **`clickhouse-bridge`** | **Sync Service** | • Service Node.js tự viết.<br>• Subscribe vào Kafka topics (`orderserver.public.orders`).<br>• Transform dữ liệu và gọi API `INSERT` vào ClickHouse Cloud. |
| **`backend`** | **API Server** | • Xử lý logic nghiệp vụ.<br>• Cung cấp API tạo đơn hàng (`POST /api/orders`).<br>• Chỉ giao tiếp với Postgres (không biết về Kafka/ClickHouse). |
| **`frontend`** | **Dashboard UI** | • Hiển thị biểu đồ, thống kê.<br>• Query dữ liệu trực tiếp từ ClickHouse Cloud để hiển thị báo cáo Real-time. |

---

## 3. Luồng Dữ Liệu (Data Flow) Khi Hệ Thống Chạy

```mermaid
sequenceDiagram
    participant Client
    participant Backend
    participant Postgres
    participant Debezium (Connect)
    participant Kafka
    participant Bridge
    participant ClickHouseCloud

    Client->>Backend: 1. POST /orders
    Backend->>Postgres: 2. INSERT (Commit)
    Postgres-->>Debezium (Connect): 3. Stream WAL Changes
    Debezium (Connect)->>Kafka: 4. Publish CDC Event
    Kafka-->>Bridge: 5. Consume Event
    Bridge->>ClickHouseCloud: 6. HTTP INSERT
```
