import { toast } from "sonner";
import type { AdminConsoleSectionKey } from "@/features/admin/adminConsoleLayout";
import type { AdminConfirmationRequest } from "@/features/admin/adminActionConfirmationContext";
import {
  getAdminConfirmationCopy,
  type AdminLang,
} from "@/features/admin/copy";
import { trpc } from "@/lib/trpc";

type TranslateFn = (zh: string, en: string) => string;

type UseAdminDirectoryParams = {
  activeSection: AdminConsoleSectionKey;
  activeDirectoryTab: "catalog" | "media";
  canReadAdmin: boolean;
  canMutateAdmin: boolean;
  lang: AdminLang;
  tr: TranslateFn;
  toUiError: (message?: string) => string;
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

export function useAdminDirectory({
  activeSection,
  activeDirectoryTab,
  canReadAdmin,
  canMutateAdmin,
  lang,
  tr,
  toUiError,
  requestConfirmation,
}: UseAdminDirectoryParams) {
  const hospitalsQuery = trpc.system.adminHospitals.useQuery(undefined, {
    enabled:
      canReadAdmin &&
      activeSection === "directory" &&
      activeDirectoryTab === "media",
  });

  const uploadMutation = trpc.system.adminUploadHospitalImage.useMutation({
    onSuccess: () => {
      void hospitalsQuery.refetch();
      toast.success(tr("医院封面上传成功。", "Hospital image uploaded."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });
  const clearMutation = trpc.system.adminClearHospitalImage.useMutation({
    onSuccess: () => {
      void hospitalsQuery.refetch();
      toast.success(tr("医院封面已清除。", "Hospital image removed."));
    },
    onError: error => {
      toast.error(toUiError(error.message));
    },
  });

  const readImageAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        const next = String(event.target?.result ?? "");
        if (!next) {
          reject(
            new Error(tr("文件读取失败，请重试。", "Failed to read file."))
          );
          return;
        }
        resolve(next);
      };
      reader.onerror = () => {
        reject(
          reader.error ??
            new Error(tr("文件读取失败。", "Failed to read file."))
        );
      };
      reader.readAsDataURL(file);
    });

  const uploadHospitalImage = async (hospitalId: number, file: File) => {
    if (!canMutateAdmin) {
      toast.message(
        tr(
          "当前角色仅可查看医院媒体。",
          "The current role has read-only access to hospital media."
        )
      );
      return;
    }
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
      toast.error(tr("无效的医院 ID。", "Invalid hospital ID."));
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(
        tr(
          "请选择图片文件（支持 jpg/png/webp/gif）。",
          "Please select an image (jpg/png/webp/gif)."
        )
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(
        tr(
          "图片超过 8MB，请缩小后重试。",
          "Image is larger than 8MB. Please compress it."
        )
      );
      return;
    }
    try {
      const imageBase64 = await readImageAsDataUrl(file);
      await uploadMutation.mutateAsync({
        hospitalId,
        fileName: file.name,
        contentType: file.type,
        imageBase64,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : tr(
              "上传失败，请稍后重试。",
              "Upload failed, please try again later."
            )
      );
    }
  };

  const clearHospitalImage = (hospitalId: number) => {
    if (!canMutateAdmin) {
      toast.message(
        tr(
          "当前角色仅可查看医院媒体。",
          "The current role has read-only access to hospital media."
        )
      );
      return;
    }
    if (!Number.isInteger(hospitalId) || hospitalId <= 0) {
      toast.error(tr("无效的医院 ID。", "Invalid hospital ID."));
      return;
    }
    const confirmation = getAdminConfirmationCopy(lang, "clearHospitalImage");
    requestConfirmation({
      title: confirmation.title,
      description: confirmation.description,
      confirmLabel: confirmation.confirmLabel,
      cancelLabel: confirmation.cancelLabel,
      tone: "danger",
      onConfirm: () => clearMutation.mutateAsync({ hospitalId }),
    });
  };

  return {
    hospitalsQuery,
    refreshDirectoryData: () => hospitalsQuery.refetch(),
    adminHospitalImageUploadMutation: {
      isPending: uploadMutation.isPending,
      uploadHospitalImage,
    },
    adminHospitalImageClearMutation: {
      isPending: clearMutation.isPending,
      clearHospitalImage,
    },
  };
}
