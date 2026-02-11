# 每日医生信息抓取任务

## 任务目标
从好大夫在线抓取医院科室的医生详细信息，并保存到GitHub的medibridge项目。

## 执行步骤

### 1. 读取技能
读取 `/home/ubuntu/skills/haodf-doctor-scraper/SKILL.md` 技能文档，了解完整的抓取流程。

### 2. 确定抓取目标
当前抓取目标：**复旦大学附属中山医院 - 呼吸科**
URL: https://www.haodf.com/hospital/420/keshi/1767/tuijian.html

### 3. 抓取医生列表
- 访问科室页面
- **重要**：滚动到页面底部（`browser_scroll direction=down to_end=true`）确保加载所有医生
- 提取所有医生的姓名、职称、ID

### 4. 并行抓取医生详细信息
使用 `map` 工具并行抓取所有医生的14个字段：
1. 医院
2. 科室
3. 姓名
4. 职称
5. 专业方向
6. 专业擅长
7. 个人简介
8. 社会任职
9. 科研成果
10. **治疗经验**（右侧边栏）
11. 疗效满意度
12. 态度满意度
13. 病友推荐度
14. 医生介绍页URL

**重要规则**：
- 跳过无"个人简介"的医生
- 遇到验证码立即停止并保存已抓取数据
- 治疗经验字段在右侧边栏，需特别提取

### 5. 生成Excel文件
将抓取结果转换为Excel格式，保存到：
`/home/ubuntu/medibridge/data/hospitals/中山医院_呼吸科_医生信息_{YYYYMMDD}.xlsx`

### 6. 推送到GitHub
```bash
cd /home/ubuntu/medibridge
git add data/hospitals/
git commit -m "Update 中山医院呼吸科医生信息 ({YYYYMMDD})"
git push origin main
```

### 7. 报告结果
生成抓取报告，包括：
- 成功抓取的医生数量
- 跳过的医生数量
- 失败的医生数量（如遇验证码）
- 治疗经验字段完整度

## 错误处理
- 如果遇到验证码，立即停止抓取，保存已有数据
- 如果某个医生页面无法访问，标记为失败但继续处理其他医生
- 所有错误信息都记录在Excel的"抓取状态"列

## 增量更新策略
- 每天抓取时，检查是否有新医生加入
- 对于已有医生，更新其最新信息
- 保留历史数据文件，按日期命名
