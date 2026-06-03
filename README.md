# EJU University Guide

一个 React + Vite 制作的 EJU 日本理工科大学选校网站 MVP。

## 已完成的第一版功能

- 首页大学卡片列表
- 大学名、地区、国立/公立/私立、可报考学部、参考 EJU 分数展示
- 点击大学卡片进入详情页
- 详情页展示 EJU 要求、英语要求、校内考、申请材料、出愿时间、考试日、合格发表日、募集要项 PDF 链接、备注等字段
- 搜索大学名、地区、专业
- 数据保存在 `src/data/universities.json`
- 未知字段显示“未确认”
- 电脑和手机响应式布局

## 运行方法

```bash
npm install
npm run dev
```

启动后打开终端里显示的本地网址，通常是：

```bash
http://localhost:5173/
```

## 修改大学数据

直接编辑：

```bash
src/data/universities.json
```

每所大学是一条 JSON 数据。后续只需要把“未确认”的字段替换为最新募集要项里的内容即可。
