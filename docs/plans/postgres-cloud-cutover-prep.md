# PostgreSQL Cloud Cutover Preparation

日期：2026-03-15

## Goal

在不立即切生产流量的前提下，把云上 PostgreSQL 切库前需要的基础设施、参数、网络和部署变更准备清楚。

这份文档关注的是：

- 先把云上 PostgreSQL 候选环境准备好
- 保持当前 MySQL 生产可回滚
- 让最终切换只变成“参数切换 + 发布 + smoke test”

## Current AWS Baseline

当前线上基础设施：

- Region: `ap-southeast-1`
- VPC: `<VPC_ID>`
- 应用 EC2:
  - instance id: `<APP_INSTANCE_ID>`
  - name tag: `<APP_INSTANCE_TAG>`
  - subnet: `<APP_SUBNET_ID>`
  - security group: `<APP_SECURITY_GROUP_ID>`
- 当前生产 RDS:
  - identifier: `<CURRENT_DATABASE_INSTANCE_ID>`
  - engine: `mysql 8.4.7`
  - class: `db.t4g.micro`
  - storage: `20 GB gp3`
  - subnet group: `<DATABASE_SUBNET_GROUP>`
  - security group: `<CURRENT_DATABASE_SECURITY_GROUP_ID>`
  - publicly accessible: `false`
  - encrypted: `true`
  - backup retention: `7 days`
  - deletion protection: `true`

当前生产配置注入方式：

- 生产进程由 PM2 启动
- 启动脚本是 [deploy/start-medibridge.mjs](/Users/ich/projects/personal/medibridge/deploy/start-medibridge.mjs)
- 运行时会读取 `/srv/medibridge/shared/.env.production`
- 如果设置了 `DATABASE_URL_SSM_PARAMETER`，应用启动时会从 AWS SSM 拉取数据库连接串

当前相关 SSM 参数路径：

- `<CURRENT_DATABASE_URL_PARAMETER>`
- `<CURRENT_DATABASE_ADMIN_PASSWORD_PARAMETER>`

## Recommended Cutover Design

建议采用：

- 新建一套 PostgreSQL RDS
- 不覆盖当前 MySQL RDS
- 不覆盖当前 MySQL SSM 参数
- 新增 PostgreSQL 专用 SSM 参数
- 通过修改 `/srv/medibridge/shared/.env.production` 中的 `DATABASE_URL_SSM_PARAMETER` 来切换

这样做的好处：

- 回滚最简单
- 不会把 MySQL 的现有连接串覆盖掉
- 生产应用的切换点只有一个

## New Infra To Prepare

### 1. PostgreSQL RDS

建议初始规格：

- engine: PostgreSQL 16
- class: `db.t4g.micro`
- storage: `20 GB gp3`
- subnet group: 继续使用 `<DATABASE_SUBNET_GROUP>`
- publicly accessible: `false`
- encrypted: `true`
- backup retention: `7 days`
- deletion protection: `true`
- Multi-AZ: `false`（一期先保持和当前 MySQL 一致）

建议命名：

- instance identifier: `<POSTGRES_DATABASE_INSTANCE_ID>`
- database name: `<POSTGRES_DATABASE_NAME>`

### 2. PostgreSQL Security Group

不要复用当前 MySQL 的 3306 规则。

建议新建一个 PostgreSQL 专用 RDS SG，例如
`<POSTGRES_DATABASE_SECURITY_GROUP_NAME>`。

入站规则：

- TCP `5432`
- source security group: `<APP_SECURITY_GROUP_ID>`

### 3. New SSM Parameters

建议新增参数，不覆盖当前 MySQL 参数：

- `<POSTGRES_ADMIN_PASSWORD_PARAMETER>`
- `<POSTGRES_DATABASE_URL_PARAMETER>`

不建议直接覆盖：

- `<CURRENT_DATABASE_URL_PARAMETER>`

因为那会让回滚变成“重新写回旧值”，风险更高。

## Application Switch Point

当前应用已经支持从 SSM 参数路径读取 `DATABASE_URL`。

推荐切换方式：

1. 保持现有 MySQL 参数不变
2. 新增 PostgreSQL 参数
3. 更新 `/srv/medibridge/shared/.env.production` 中的：
   - `DATABASE_URL_SSM_PARAMETER=<POSTGRES_DATABASE_URL_PARAMETER>`
4. 重新发布或 `pm2 startOrReload`

这样：

- 应用逻辑不用改
- rollback 时只需把 `DATABASE_URL_SSM_PARAMETER` 改回
  `<CURRENT_DATABASE_URL_PARAMETER>`

## Preparation Sequence

### Step 1. Provision PostgreSQL RDS

需要完成：

- 创建 `<POSTGRES_DATABASE_INSTANCE_ID>`
- 挂上 `<DATABASE_SUBNET_GROUP>`
- 绑定新的 PostgreSQL SG
- 打开备份和删除保护

### Step 2. Create PostgreSQL SSM Parameters

创建：

- `<POSTGRES_ADMIN_PASSWORD_PARAMETER>`
- `<POSTGRES_DATABASE_URL_PARAMETER>`

注意：

- 文档里不要落明文密码
- URL 中数据库名使用 `<POSTGRES_DATABASE_NAME>`

### Step 3. Bootstrap Schema

针对新的 PostgreSQL RDS：

1. 设置 `DATABASE_URL` 指向 PostgreSQL 候选库
2. 执行：
   - `pnpm db:migrate`
   - `pnpm db:verify:migrations`

成功标准：

- `drizzle.__drizzle_migrations` 有 2 条记录
- `visit_retention_policies` 有默认 2 行

### Step 4. Seed and Backfill

按顺序执行：

1. `pnpm import:doctors`
2. `pnpm exec tsx scripts/backfill-doctor-specialty-tags.ts`
3. `pnpm translate:bilingual`
4. `pnpm vectorize:doctors`

### Step 5. Cloud Validation

在 PostgreSQL 候选库上完成：

- `pnpm verify:doctors:postgres`
- `pnpm verify:core:postgres`
- 手工验证：
  - doctor search
  - doctor recommend
  - AI triage
  - appointment create
  - admin appointments

### Step 6. Prepare Rollback

在正式切换前确保：

- MySQL RDS 保持不动
- `<CURRENT_DATABASE_URL_PARAMETER>` 保持不动
- `/srv/medibridge/shared/.env.production` 当前值可回退

## Cutover-Day Command Targets

真正切换当天，最关键的动作只有三类：

1. 更新共享 env 文件中的 `DATABASE_URL_SSM_PARAMETER`
2. Reload PM2
3. 做 smoke test

其中 smoke test 至少包括：

- `curl -I http://127.0.0.1:3000/`
- hospitals list
- doctor search
- doctor recommend
- appointment create
- token access

## Rollback Rule

如果切换后出现以下任意问题，立即回滚：

- 应用启动失败
- 数据库连接失败
- doctor search / recommend 异常
- appointment create 失败
- visit 消息写入失败

回滚步骤：

1. 把 `/srv/medibridge/shared/.env.production` 中的
   `DATABASE_URL_SSM_PARAMETER` 改回 `<CURRENT_DATABASE_URL_PARAMETER>`
2. `pm2 startOrReload /srv/medibridge/current/deploy/ecosystem.config.cjs --update-env`
3. 重跑健康检查和核心 smoke test

## Recommended Immediate Next Step

下一步最值得先做的不是直接切流，而是：

1. 创建新的 PostgreSQL RDS
2. 创建新的 PostgreSQL SSM 参数
3. 在候选库上跑一次 `db:migrate + seed + verify`

做到这一步之后，生产切库就只剩下部署层切换，不再是数据库重构。

## AWS CLI Skeleton

下面这些命令是基于当前 AWS 现状整理的骨架，执行前只需要替换少量占位值。

### 1. 创建 PostgreSQL RDS 安全组

```bash
aws ec2 create-security-group \
  --region ap-southeast-1 \
  --group-name <POSTGRES_DATABASE_SECURITY_GROUP_NAME> \
  --description "MediBridge PostgreSQL RDS security group" \
  --vpc-id <VPC_ID>

aws ec2 authorize-security-group-ingress \
  --region ap-southeast-1 \
  --group-id <NEW_POSTGRES_SG_ID> \
  --ip-permissions '<POSTGRES_INGRESS_RULE_JSON>'
```

### 2. 创建 PostgreSQL RDS

```bash
aws rds create-db-instance \
  --region ap-southeast-1 \
  --db-instance-identifier <POSTGRES_DATABASE_INSTANCE_ID> \
  --engine postgres \
  --engine-version 16.4 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 \
  --storage-type gp3 \
  --storage-encrypted \
  --master-username <POSTGRES_ADMIN_USER> \
  --master-user-password '<POSTGRES_MASTER_PASSWORD>' \
  --db-name <POSTGRES_DATABASE_NAME> \
  --db-subnet-group-name <DATABASE_SUBNET_GROUP> \
  --vpc-security-group-ids <NEW_POSTGRES_SG_ID> \
  --backup-retention-period 7 \
  --no-publicly-accessible \
  --deletion-protection
```

### 3. 写入 PostgreSQL SSM 参数

```bash
aws ssm put-parameter \
  --region ap-southeast-1 \
  --name <POSTGRES_ADMIN_PASSWORD_PARAMETER> \
  --type SecureString \
  --overwrite \
  --value '<POSTGRES_MASTER_PASSWORD>'

aws ssm put-parameter \
  --region ap-southeast-1 \
  --name <POSTGRES_DATABASE_URL_PARAMETER> \
  --type SecureString \
  --overwrite \
  --value '<POSTGRES_DATABASE_URL>'
```

### 4. 切换生产应用读取的参数路径

生产应用当前的切换点是 `/srv/medibridge/shared/.env.production` 里的：

```bash
DATABASE_URL_SSM_PARAMETER=<CURRENT_DATABASE_URL_PARAMETER>
```

切换到 PostgreSQL 时，改成：

```bash
DATABASE_URL_SSM_PARAMETER=<POSTGRES_DATABASE_URL_PARAMETER>
```

然后执行：

```bash
pm2 startOrReload /srv/medibridge/current/deploy/ecosystem.config.cjs --update-env
```
