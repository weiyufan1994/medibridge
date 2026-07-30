import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import {
  AdminActionConfirmationContext,
  type AdminConfirmationRequest,
} from "@/features/admin/adminActionConfirmationContext";
import { cn } from "@/lib/utils";

export function AdminActionConfirmationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [request, setRequest] = useState<AdminConfirmationRequest | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const requestConfirmation = useCallback(
    (nextRequest: AdminConfirmationRequest) => {
      setRequest(nextRequest);
    },
    []
  );

  const value = useMemo(() => ({ requestConfirmation }), [requestConfirmation]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isConfirming) {
      setRequest(null);
    }
  };

  const handleConfirm = async () => {
    if (!request || isConfirming) {
      return;
    }

    setIsConfirming(true);
    try {
      await request.onConfirm();
      setRequest(null);
    } catch {
      // Mutation-specific handlers surface the server error and the dialog
      // remains open so the operator can retry or cancel.
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <AdminActionConfirmationContext.Provider value={value}>
      {children}
      <AlertDialog open={request !== null} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>
              {request?.cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming}
              className={cn(
                request?.tone === "danger" &&
                  buttonVariants({ variant: "destructive" })
              )}
              onClick={event => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {request?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminActionConfirmationContext.Provider>
  );
}
