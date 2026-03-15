import "../server/_core/loadEnv";
import { and, eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";

type Role = "free" | "pro" | "admin";

type CliOptions = {
  emails: string[];
  ids: number[];
  role: Role;
  dryRun: boolean;
};

type ParsedArgs = CliOptions & { help: boolean };

function parseArgs(argv: string[]): ParsedArgs {
  const normalizedArgv = argv[0] === "--" ? argv.slice(1) : argv;
  const args: ParsedArgs = {
    emails: [],
    ids: [],
    role: "admin",
    dryRun: false,
    help: false,
  };

  const next = (idx: number): string | undefined =>
    normalizedArgv[idx + 1];

  for (let i = 0; i < normalizedArgv.length; i += 1) {
    const current = normalizedArgv[i];
    if (!current) continue;

    if (current === "--help" || current === "-h") {
      args.help = true;
      continue;
    }

    if (current === "--dry-run" || current === "-n") {
      args.dryRun = true;
      continue;
    }

    if (current === "--email" || current === "-e") {
      const value = next(i)?.trim();
      if (!value) {
        throw new Error(`--email requires a value`);
      }
      args.emails.push(value);
      i += 1;
      continue;
    }

    if (current.startsWith("--email=")) {
      const value = current.slice("--email=".length).trim();
      if (value.length === 0) {
        throw new Error(`--email requires a value`);
      }
      args.emails.push(value);
      continue;
    }

    if (current === "--id") {
      const value = next(i)?.trim();
      const parsedId = value ? Number(value) : Number.NaN;
      if (!value || Number.isNaN(parsedId) || !Number.isInteger(parsedId)) {
        throw new Error(`--id requires an integer`);
      }
      args.ids.push(parsedId);
      i += 1;
      continue;
    }

    if (current.startsWith("--id=")) {
      const value = current.slice("--id=".length).trim();
      const parsedId = Number(value);
      if (!value || Number.isNaN(parsedId) || !Number.isInteger(parsedId)) {
        throw new Error(`--id requires an integer`);
      }
      args.ids.push(parsedId);
      continue;
    }

    if (current === "--role") {
      const value = next(i)?.trim();
      if (!value) {
        throw new Error(`--role requires a value: free|pro|admin`);
      }
      args.role = parseRole(value);
      i += 1;
      continue;
    }

    if (current.startsWith("--role=")) {
      const value = current.slice("--role=".length).trim();
      args.role = parseRole(value);
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

function parseRole(raw: string): Role {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "free" || normalized === "pro" || normalized === "admin") {
    return normalized;
  }

  throw new Error(`Invalid --role value: ${raw}. Allowed values are free|pro|admin`);
}

function printUsage(): void {
  console.log(`
用法：
  pnpm tsx scripts/admin-user.ts --email admin1@example.com --email admin2@example.com
  pnpm tsx scripts/admin-user.ts --id 123 --id 456 --role admin
  pnpm tsx scripts/admin-user.ts --role free --email someone@example.com
  pnpm tsx scripts/admin-user.ts --role free --id 101   (用于回撤管理员权限)
  pnpm tsx scripts/admin-user.ts --dry-run --email xxx@xxx.com

参数：
  --email, -e     按邮箱设置权限
  --id            按用户ID设置权限
  --role          目标角色：admin|pro|free（默认：admin）
  --dry-run, -n   仅预演，不写库
  --help, -h      显示帮助
`);
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

async function findUserByEmail(db: Awaited<ReturnType<typeof getDb>>, email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result[0];
}

async function findUserById(db: Awaited<ReturnType<typeof getDb>>, id: number) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

async function main() {
  let options: ParsedArgs;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[admin-user] 参数解析失败: ${(error as Error).message}`);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    return;
  }

  if (options.emails.length === 0 && options.ids.length === 0) {
    console.error("[admin-user] 请至少提供 --email 或 --id");
    printUsage();
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    throw new Error("[admin-user] 无法连接数据库，请先配置 DATABASE_URL");
  }

  const emails = dedupe(options.emails.map(email => email.toLowerCase()));
  const ids = dedupe(options.ids);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const email of emails) {
    const row = await findUserByEmail(db, email);
    processed += 1;

    if (!row) {
      skipped += 1;
      console.log(`[MISS] email=${email} -> not found`);
      continue;
    }

    const nextRole = options.role;
    const willChange =
      row.role !== nextRole || row.isGuest === 1;
    const targetRole = nextRole;
    const targetIsGuest = 0;

    if (!willChange) {
      console.log(
        `[SKIP] id=${row.id}, email=${row.email}, role=${row.role}, isGuest=${row.isGuest}`
      );
      skipped += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(
        `[DRY-RUN] id=${row.id}, email=${row.email}, role: ${row.role} -> ${targetRole}, isGuest: ${row.isGuest} -> ${targetIsGuest}`
      );
      updated += 1;
      continue;
    }

    await db
      .update(users)
      .set({
        role: nextRole,
        isGuest: 0,
      })
      .where(and(eq(users.id, row.id)));

    updated += 1;
    console.log(
      `[OK] id=${row.id}, email=${row.email}, role: ${row.role} -> ${targetRole}, isGuest: ${row.isGuest} -> ${targetIsGuest}`
    );
  }

  for (const id of ids) {
    const row = await findUserById(db, id);
    processed += 1;

    if (!row) {
      skipped += 1;
      console.log(`[MISS] id=${id} -> not found`);
      continue;
    }

    const nextRole = options.role;
    const willChange = row.role !== nextRole || row.isGuest === 1;

    if (!willChange) {
      console.log(
        `[SKIP] id=${row.id}, email=${row.email}, role=${row.role}, isGuest=${row.isGuest}`
      );
      skipped += 1;
      continue;
    }

    if (options.dryRun) {
      console.log(
        `[DRY-RUN] id=${row.id}, email=${row.email}, role: ${row.role} -> ${nextRole}, isGuest: ${row.isGuest} -> 0`
      );
      updated += 1;
      continue;
    }

    await db
      .update(users)
      .set({
        role: options.role,
        isGuest: 0,
      })
      .where(and(eq(users.id, row.id)));

    updated += 1;
    console.log(
      `[OK] id=${row.id}, email=${row.email}, role: ${row.role} -> ${options.role}, isGuest: ${row.isGuest} -> 0`
    );
  }

  console.log(
    `\n汇总: processed=${processed}, updated=${updated}, skipped=${skipped}, dryRun=${options.dryRun}, role=${options.role}`
  );
}

main().catch(error => {
  console.error("[admin-user] failed", error);
  process.exit(1);
}).finally(async () => {
  const db = await getDb();
  const client = (db as { $client?: { end?: (...args: unknown[]) => unknown } } | null)?.$client;
  const end = client?.end;
  if (typeof end === "function") {
    const result = end.call(client);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      await result.catch(() => undefined);
    }
  }
});
