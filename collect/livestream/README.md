# 全球实时地理数据（livestream）

全球实时地理/事件数据源模块。当前已接入 USGS 地震数据，并预留实时摄像头/地图
聚合源的扩展位。

## 数据源

- **USGS 地震**（https://earthquake.usgs.gov/）：近 24 小时全球地震，免费、无需 key

## MCP 工具

| 工具 | 说明 |
|------|------|
| `earthquakes_recent` | 近 24 小时全球地震（可按最小震级过滤） |

## 示例

```
earthquakes_recent(min_mag=5, limit=20)   # 近 24 小时 ≥5 级地震
```

## 扩展方向

- 全球实时摄像头/地图聚合源（待接入具体项目）
- 世界航班/船舶实时位置（可用 World Monitor 的 `get_maritime_activity`、
  `get_aviation_status` 工具，需 API key）
- 其它实时地理事件（台风、森林火灾、空气质量等）
