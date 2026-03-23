import { adminOrOpsProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { schedulingActions, schedulingSchemas } from "../modules/scheduling/routerApi";

export const schedulingRouter = router({
  listAvailableSlots: publicProcedure
    .input(schedulingSchemas.listAvailableSlotsInputSchema)
    .output(schedulingSchemas.listAvailableSlotsOutputSchema)
    .query(({ input }) => schedulingActions.listAvailableSlots(input)),

  listScheduleRules: adminOrOpsProcedure
    .input(schedulingSchemas.listScheduleRulesInputSchema)
    .output(schedulingSchemas.listScheduleRulesOutputSchema)
    .query(({ input }) => schedulingActions.listScheduleRules(input)),

  createScheduleRule: adminOrOpsProcedure
    .input(schedulingSchemas.createScheduleRuleInputSchema)
    .output(schedulingSchemas.scheduleRuleOutputSchema)
    .mutation(({ input, ctx }) =>
      schedulingActions.createScheduleRule({
        ...input,
        actorRole: ctx.user.role,
        actorUserId: ctx.user.id,
      })
    ),

  updateScheduleRule: adminOrOpsProcedure
    .input(schedulingSchemas.updateScheduleRuleInputSchema)
    .output(schedulingSchemas.scheduleRuleOutputSchema)
    .mutation(({ input, ctx }) =>
      schedulingActions.updateScheduleRule({
        ...input,
        actorRole: ctx.user.role,
        actorUserId: ctx.user.id,
      })
    ),

  deleteScheduleRule: adminOrOpsProcedure
    .input(schedulingSchemas.deleteScheduleRuleInputSchema)
    .mutation(({ input }) => schedulingActions.deleteScheduleRule(input.id)),

  listScheduleExceptions: adminOrOpsProcedure
    .input(schedulingSchemas.listScheduleExceptionsInputSchema)
    .output(schedulingSchemas.listScheduleExceptionsOutputSchema)
    .query(({ input }) => schedulingActions.listScheduleExceptions(input)),

  createScheduleException: adminOrOpsProcedure
    .input(schedulingSchemas.createScheduleExceptionInputSchema)
    .output(schedulingSchemas.scheduleExceptionOutputSchema)
    .mutation(({ input }) => schedulingActions.createScheduleException(input)),

  updateScheduleException: adminOrOpsProcedure
    .input(schedulingSchemas.updateScheduleExceptionInputSchema)
    .output(schedulingSchemas.scheduleExceptionOutputSchema)
    .mutation(({ input }) => schedulingActions.updateScheduleException(input)),

  deleteScheduleException: adminOrOpsProcedure
    .input(schedulingSchemas.deleteScheduleExceptionInputSchema.extend({
      doctorId: schedulingSchemas.listScheduleExceptionsInputSchema.shape.doctorId,
    }))
    .mutation(({ input }) =>
      schedulingActions.deleteScheduleException({
        id: input.id,
        doctorId: input.doctorId,
      })
    ),

  createManualSlot: adminOrOpsProcedure
    .input(schedulingSchemas.createManualSlotInputSchema)
    .output(schedulingSchemas.slotOutputSchema)
    .mutation(({ input }) =>
      schedulingActions.createManualSlots({
        slots: [input],
      }).then(rows => rows[0]!)
    ),

  bulkCreateManualSlots: adminOrOpsProcedure
    .input(schedulingSchemas.bulkCreateManualSlotsInputSchema)
    .output(schedulingSchemas.listAvailableSlotsOutputSchema)
    .mutation(({ input }) => schedulingActions.createManualSlots(input)),

  regenerateDoctorSlots: adminOrOpsProcedure
    .input(schedulingSchemas.generateDoctorSlotsInputSchema)
    .mutation(({ input }) => schedulingActions.regenerateDoctorSlots(input)),

  blockSlot: adminOrOpsProcedure
    .input(schedulingSchemas.deleteScheduleRuleInputSchema)
    .output(schedulingSchemas.slotOutputSchema)
    .mutation(({ input }) => schedulingActions.blockSlot(input.id)),

  unblockSlot: adminOrOpsProcedure
    .input(schedulingSchemas.deleteScheduleRuleInputSchema)
    .output(schedulingSchemas.slotOutputSchema)
    .mutation(({ input }) => schedulingActions.unblockSlot(input.id)),

  listDoctorUpcomingSlots: protectedProcedure
    .input(schedulingSchemas.listDoctorUpcomingSlotsInputSchema)
    .output(schedulingSchemas.listAvailableSlotsOutputSchema)
    .query(({ input, ctx }) =>
      schedulingActions.listDoctorUpcomingSlots({
        doctorId: input.doctorId,
        currentUserId: ctx.user.id,
        currentUserRole: ctx.user.role,
      })
    ),
});
