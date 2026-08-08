import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

export type ProcedureAccess = "admin" | "adminOrOps" | "protected" | "public";

interface ProcedureMeta {
  access: ProcedureAccess;
}

const t = initTRPC.context<TrpcContext>().meta<ProcedureMeta>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure.meta({ access: "public" });

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure
  .meta({ access: "protected" })
  .use(requireUser);

export const adminOrOpsProcedure = t.procedure
  .meta({ access: "adminOrOps" })
  .use(
    t.middleware(async opts => {
      const { ctx, next } = opts;
      const role = ctx.user ? String(ctx.user.role) : "";

      if (!ctx.user || (role !== "admin" && role !== "ops")) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    })
  );

export const adminProcedure = t.procedure.meta({ access: "admin" }).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const role = ctx.user ? String(ctx.user.role) : "";

    if (!ctx.user || role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
