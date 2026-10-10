# 全球新闻资讯（global-news）

聚合全球主要媒体的实时新闻资讯，使用 Google News RSS（无需 API key）。

## 数据源

Google News RSS（https://news.google.com/rss）

- 无需 key，开箱即用
- 支持按地区热榜 / 按关键词搜索，支持多语言

## MCP 工具

| 工具 | 说明 |
|------|------|
| `news_top` | 某国家/地区实时新闻热榜（默认 CN / zh-CN） |
| `news_search` | 按关键词搜索全球新闻 |

## 示例

```
news_top(region="US", lang="en", limit=20)        # 美国英语新闻热榜
news_search(keyword="AI", region="CN")            # 搜索 AI 相关新闻
```

## 扩展数据源

- 接入 World Monitor（`worldmonitor_news`）可获得 AI 合成新闻简报、新闻聚类、
  关键词突增分析等更深度能力（需 API key）。
- 可在此目录添加其它 RSS/媒体源（BBC、Reuters、CNN 等官方 RSS）扩展采集。
