# MediBridge 扩展路线图（医生库 / AI / 渠道）

## 1) 医生数据库完善（以好大夫为底）

- 数据主键：`hospital + department + doctor name` 去重。
- 质量规则：
  - 缺失值：医院、科室、医生姓名、专长。
  - 异常值：推荐分数不在 `0-10` 区间、URL 非法、疑似占位词（如“未知”）。
  - 可信来源优先级：好大夫 > 医院官网 > 第三方。
- 每次导入后执行 `node scripts/audit-doctors.mjs` 产出审计报告。

## 2) 每科室 1-2 名代表医生

- 后端新增 `getDepartmentHighlights` 聚合接口。
- 规则：优先有 `haodafUrl` 的医生，其次按 `recommendationScore`。
- 前端首页展示“Department Quick Guide”。

## 3) AI 引导患者咨询与下单

- 系统提示词固定追加 CTA：
  - `consult the registered doctor in the specific department for more information. Check out if you need treatment in China and in which hospital, department and doctor. Get your time cost and billing estimations`
- 对话策略：
  - 先问症状与病程（1-2轮）
  - 立刻给医院/科室/医生组合
  - 明确下一步：预约、时长预估、费用预估

## 4) 特色疗法首页前置

- 首页新增 Featured Therapies 模块。
- 示例：潘博士狐臭微创治疗入口（治疗说明 + 风险提示 + 预约引导）。

## 5) PubMed 与医生一一对应（本地语料）

- 新增脚本 `scripts/pubmed-doctor-sync.mjs`：
  - 读取医生信息
  - 用医生中英名/科室关键词拉取 PubMed 文献摘要（可先 dry-run）
  - 产出 `data/pubmed-doctor-map.json` 作为本地语料
- 后续与向量库结合，为 AI 推荐方案提供循证依据。

## 6) 新分发渠道：OpenClaw Bot 跨境转发

- 建议架构：
  - 患者端：WhatsApp / Telegram
  - 机器人层：OpenClaw（会话路由、翻译、审计）
  - 医生端：飞书/企业微信
  - 中间件：消息标准化（会话ID、用户ID、医生ID、语言）
- 最小闭环：
  1. 患者发消息到 WA/TG
  2. Bot 生成工单 + 意图识别（科室）
  3. 转发医生端
  4. 回包到 WA/TG
  5. 沉淀到会话库用于复诊和 CRM
