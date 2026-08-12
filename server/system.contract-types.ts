import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { systemRouter } from "./routers/system";
import type { ExpectedSystemRouterInputs } from "./system.contract-inputs";
import type { ExpectedSystemRouterOutputs } from "./system.contract-outputs";

type Normalize<T> = T extends Date
  ? Date
  : T extends readonly (infer Item)[]
    ? Normalize<Item>[]
    : T extends object
      ? { -readonly [Key in keyof T]: Normalize<T[Key]> }
      : T;

type AssertExact<Actual, Expected> = [Actual, Expected] extends [
  Expected,
  Actual,
]
  ? true
  : never;

type ActualInputs = Normalize<inferRouterInputs<typeof systemRouter>>;
type ActualOutputs = Normalize<inferRouterOutputs<typeof systemRouter>>;

export const systemRouterInputContractIsFrozen: AssertExact<
  ActualInputs,
  Normalize<ExpectedSystemRouterInputs>
> = true;
export const systemRouterOutputContractIsFrozen: AssertExact<
  ActualOutputs,
  Normalize<ExpectedSystemRouterOutputs>
> = true;
