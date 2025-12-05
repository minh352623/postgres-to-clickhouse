# File `debezium/connector-config.json` Được Sử Dụng Ở Đâu?

File này được sử dụng bởi service **`connector-registrar`** trong `docker-compose.yml`.

## Quy Trình Sử Dụng

1. **Mount Volume**:
   Trong `docker-compose.yml`, thư mục `./debezium` được mount vào trong container `connector-registrar` tại đường dẫn `/config`.

   ```yaml
   connector-registrar:
     image: curlimages/curl:latest
     # ...
     volumes:
       - ./debezium:/config  <-- Mount file config vào đây
     command: sh /config/register.sh
   ```

2. **Script Đăng Ký (`register.sh`)**:
   Khi container `connector-registrar` khởi động, nó chạy script `register.sh`. Script này sẽ đọc file `connector-config.json` và gửi nó đến Kafka Connect qua API.

   ```bash
   # Nội dung của register.sh (đã đơn giản hóa)
   
   # Đọc file config
   CONFIG_FILE="/config/connector-config.json"
   
   # Gửi request POST đến Kafka Connect API
   curl -X POST -H "Content-Type: application/json" \
     --data @$CONFIG_FILE \
     http://kafka-connect:8083/connectors
   ```

3. **Kafka Connect**:
   Kafka Connect nhận JSON này và khởi tạo Debezium Connector với các tham số đã cấu hình (kết nối Postgres, topic prefix, table whitelist...).

## Tóm Tắt Luồng Đi

```
File (Host)                    Container (Registrar)           Service (Kafka Connect)
connector-config.json  ──mount──>  /config/connector-config.json  ──curl──>  API:8083/connectors
```

## Tại Sao Làm Cách Này?

Cách này giúp **tự động hóa** việc đăng ký connector. Thay vì bạn phải chạy lệnh `curl` thủ công mỗi khi khởi động lại hệ thống, container `connector-registrar` sẽ tự làm việc đó cho bạn ngay khi hệ thống start.
