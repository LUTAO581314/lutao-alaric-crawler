# 全球航班实时数据（global-flights）

基于 [OpenSky Network](https://opensky-network.org/) 开放 API，获取全球民航航班实时数据。

## 数据源

OpenSky Network（https://opensky-network.org/apidoc/rest.html）

- 匿名访问即可调用（有频率限制：状态接口约 10 req/s，src 约 400 req/h）
- 注册账号后可获得更高配额：<https://opensky-network.org/users/sign_in>

## 配置

- 匿名使用：无需配置，直接可用
- 注册后：在 `.env` 设置 `OPENSKY_USERNAME` / `OPENSKY_PASSWORD`

## MCP 工具

| 工具 | 说明 |
|------|------|
| `flights_all` | 全球当前所有在飞航班实时状态 |
| `flights_area` | 指定经纬度边界框内的航班 |
| `flight_track` | 某航班历史轨迹 |

## 示例

```
flights_area(lamin=39, lomin=115, lamax=42, lomax=118)   # 北京周边
flights_all()                                              # 全球在飞航班
flight_track(icao24="781d50")                             # 某航班轨迹
```

## 备用数据源

如需更强航班数据，可在 World Monitor（`worldmonitor_flights` 工具）中使用 Wingbits ADS-B
数据源，覆盖更全。
