export function shouldShowVisitRoomLoadingState(input: {
  isLoading: boolean;
  hasAppointmentData: boolean;
}) {
  return input.isLoading && !input.hasAppointmentData;
}
