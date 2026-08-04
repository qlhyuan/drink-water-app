# 每日喝水 - Web 版原型

> HTML + CSS 高保真原型，响应式设计（移动端 + 桌面端）

## 预览

```bash
cd prototype
python3 -m http.server 8765
# 浏览器打开 http://localhost:8765
```

## 包含页面

### 移动端（375 × 700）
- `mobile-home.html` - 首页（圆环 + 快速 + 杯型 + 记录）
- `mobile-history.html` - 历史（柱状图 + 热力图）
- `mobile-goal.html` - 目标设置
- `mobile-achievement.html` - 成就墙
- `mobile-profile.html` - 个人中心

### 桌面端（1200 × 760）
- `desktop-login.html` - 登录页
- `desktop-home.html` - 首页（含侧边栏）
- `desktop-history.html` - 历史（完整数据看板）

### 总览
- `index.html` - 所有屏幕汇总预览

## 设计要点

| 维度 | 方案 |
|------|------|
| 主色调 | 清新绿 #10b981 |
| 移动端 | 底部 tabbar + 单列卡片 |
| 桌面端 | 左侧侧边栏 + 双栏布局 |
| 圆环 | conic-gradient 实现 |
| 图表 | 纯 CSS 柱状图 + 热力图 |
| 响应式 | 同一组件库适配两套布局 |

## 反馈

对照预览图，告诉我哪些地方需要调整即可。
