type MockQueryState<TData> = {
  data: TData | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<{ data: TData | undefined }>;
};

export type BookingWorklistQueryInput = {
  email?: string;
  status?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  page?: number;
  page_size?: number;
};

export type BookingWorklistQueryRow = {
  appointment_id: number;
  user_id: number | null;
  email: string;
  status: string;
  payment_status: string;
  amount: number;
  currency: string;
  doctor_id: number | null;
  triage_session_id: number | null;
  scheduled_at: string | null;
  created_at: string;
  risk_flag: boolean;
  risk_codes: string[];
};

export type BookingWorklistQueryResult = {
  items: BookingWorklistQueryRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type BookingDetailQueryResult = {
  appointment_id: number;
  user_id: number | null;
  email: string;
  status: string;
  payment_status: string;
  amount: number;
  currency: string;
  risk_flag: boolean;
};

export type TrpcBookingMock = {
  booking: {
    getWorklist: {
      useQuery: (
        input: BookingWorklistQueryInput
      ) => MockQueryState<BookingWorklistQueryResult>;
    };
    getDetail: {
      useQuery: (input: {
        appointment_id: number;
      }) => MockQueryState<BookingDetailQueryResult>;
    };
  };
};

export const trpcBookingMock: TrpcBookingMock = {
  booking: {
    getWorklist: {
      useQuery: () => ({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: async () => ({ data: undefined }),
      }),
    },
    getDetail: {
      useQuery: () => ({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: async () => ({ data: undefined }),
      }),
    },
  },
};
