# 每日好大夫医生抓取

## 目标

维护 `data/hospitals/` 下的医生 Excel 数据，并为后续导入数据库提供稳定输入。

当前仓库的真实进度来源不是 `data/scraping_progress/*`，而是：
- 科室索引：`data/departments/all_departments.json`
- 已完成判断：`data/hospitals/{医院}/*.xlsx`
- 运行日志：`data/departments/progress.json`

## 当前工作流

### 1. 查看下一个待抓取科室

```bash
python3 scripts/track_progress.py
```

这个脚本会：
- 读取 `data/departments/all_departments.json`
- 扫描 `data/hospitals/**/*.xlsx`
- 输出总体进度、按医院统计，以及下一个未完成科室

### 2. 抓取单个科室

抓取输入以 `track_progress.py` 输出为准：
- 医院名称
- 科室名称
- 科室 URL

抓取要求：
1. 进入科室页面并滚动到底，确保医生列表完整加载。
2. 提取医生列表并逐个进入详情页。
3. 跳过无个人简介的医生。
4. 尽量保留以下字段：
   - 医院
   - 科室
   - 姓名
   - 职称
   - 专业方向
   - 专业擅长
   - 个人简介
   - 社会任职
   - 科研成果
   - 治疗经验
   - 疗效满意度
   - 态度满意度
   - 病友推荐度
   - 医生介绍页 URL

### 3. 保存抓取结果

输出文件统一放在：

```text
data/hospitals/{医院名称}/{科室}_医生详细信息_{YYYYMMDD}.xlsx
```

例如：

```text
data/hospitals/复旦大学附属中山医院/呼吸科_医生详细信息_20260211.xlsx
```

`scripts/track_progress.py` 同时兼容历史命名，但新增文件应始终使用上面的新格式。

### 4. 记录运行结果

抓取完成后，将结果追加到 `data/departments/progress.json`：

```python
from scripts.track_progress import ProgressTracker

tracker = ProgressTracker()
tracker.save_progress(department, "success", "成功抓取 N 位医生")
```

如果遇到验证码或中断：

```python
tracker.save_progress(department, "captcha", "遇到验证码，已保存部分结果")
```

允许状态：
- `success`
- `failed`
- `captcha`

### 5. 提交仓库

```bash
git add data/hospitals data/departments/progress.json
git commit -m "Update doctor data for {医院} {科室}"
git push origin main
```

## 质量要求

- 基本字段（医院、科室、姓名、职称、URL）应尽量完整
- 专业字段（专业方向、专业擅长、个人简介）优先保证
- 治疗经验允许部分缺失
- 所有 Excel 文件都应能被 `scripts/import-doctors.mjs` 正常识别

## 导入前检查

新增或更新 Excel 后，至少先确认：
- `python3 scripts/track_progress.py` 能正确识别新文件
- 文件命名符合 `{科室}_医生详细信息_{YYYYMMDD}.xlsx`
- 表头仍兼容 `scripts/import-doctors.mjs` 里的字段映射

只有在你准备同步数据库时，才执行导入脚本：

```bash
node scripts/import-doctors.mjs
```

## 维护原则

- 每次只处理一个科室，降低反爬风险
- 新抓取文件不要覆盖历史文件，按日期新增
- 文档以当前仓库脚本为准；如果进度逻辑改动，优先同步更新本文件和 `scripts/track_progress.py`
