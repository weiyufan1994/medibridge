import { getOrCreateDeviceId } from "@/features/auth/deviceId";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type AuthUiState = {
  isLoginModalOpen: boolean;
};

let authUiState: AuthUiState = {
  isLoginModalOpen: false,
};

const authUiListeners = new Set<() => void>();

function emitAuthUiChange() {
  authUiListeners.forEach(listener => listener());
}

function setLoginModalOpen(nextOpen: boolean) {
  if (authUiState.isLoginModalOpen === nextOpen) {
    return;
  }

  authUiState = {
    ...authUiState,
    isLoginModalOpen: nextOpen,
  };
  emitAuthUiChange();
}

function subscribeAuthUi(listener: () => void) {
  authUiListeners.add(listener);
  return () => {
    authUiListeners.delete(listener);
  };
}

function getAuthUiSnapshot() {
  return authUiState;
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/" } =
    options ?? {};
  const utils = trpc.useUtils();
  const authUi = useSyncExternalStore(
    subscribeAuthUi,
    getAuthUiSnapshot,
    getAuthUiSnapshot
  );

  useEffect(() => {
    getOrCreateDeviceId();
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      isGuest: meQuery.data?.isGuest === 1,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data && meQuery.data.isGuest !== 1),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    isLoginModalOpen: authUi.isLoginModalOpen,
    openLoginModal: () => setLoginModalOpen(true),
    closeLoginModal: () => setLoginModalOpen(false),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
