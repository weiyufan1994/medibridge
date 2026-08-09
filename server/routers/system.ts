import { router } from "../_core/trpc";
import { systemProcedureMap } from "../modules/admin/routerApi";

export const systemRouter = router(systemProcedureMap);
