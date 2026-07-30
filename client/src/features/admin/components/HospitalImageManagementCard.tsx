import { useRef } from "react";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MISSING_TRANSLATION, getLocalizedText } from "@/lib/i18n";
import type { AdminHospital } from "@/features/admin/types";
import type {
  HospitalImageClearState,
  HospitalImageUploadState,
} from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type Props = {
  tr: TranslateFn;
  lang: "zh" | "en";
  isLoading: boolean;
  errorMessage?: string;
  hospitals: AdminHospital[];
  isReadOnly?: boolean;
  uploadState: HospitalImageUploadState;
  clearState: HospitalImageClearState;
};

const HOSPITAL_IMAGE_ALT_EN = "Hospital cover image";
const TITLE_PLACEHOLDER_BY_LANG = {
  en: MISSING_TRANSLATION,
  zh: MISSING_TRANSLATION,
} as const;
const CITY_PLACEHOLDER_BY_LANG = {
  en: "",
  zh: "",
} as const;

type HospitalImageCardPresentation = {
  title: string;
  city: string;
  imageAlt: string;
};

export function getHospitalImageCardPresentation(input: {
  lang: "zh" | "en";
  hospital: Pick<AdminHospital, "name" | "city">;
}): HospitalImageCardPresentation {
  const title = getLocalizedText({
    lang: input.lang,
    value: input.hospital.name,
    placeholder: TITLE_PLACEHOLDER_BY_LANG[input.lang],
  });
  const city = getLocalizedText({
    lang: input.lang,
    value: input.hospital.city,
    placeholder: CITY_PLACEHOLDER_BY_LANG[input.lang],
  });

  return {
    title,
    city,
    imageAlt: {
      en: title === MISSING_TRANSLATION ? HOSPITAL_IMAGE_ALT_EN : title,
      zh: title,
    }[input.lang],
  };
}

export function HospitalImageManagementCard({
  tr,
  lang,
  isLoading,
  errorMessage,
  hospitals,
  isReadOnly = false,
  uploadState,
  clearState,
}: Props) {
  const fileInputRefs = useRef(new Map<number, HTMLInputElement | null>());

  const handleUpload = (hospitalId: number, file: File | null) => {
    if (isReadOnly || !file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error(
        tr(
          "请选择图片文件（jpg/png/webp/gif）",
          "Please select an image file (jpg/png/webp/gif)."
        )
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error(
        tr("图片大小不能超过 8MB。", "Image size cannot exceed 8MB.")
      );
      return;
    }
    void uploadState.uploadHospitalImage(hospitalId, file);
  };

  const openFilePicker = (hospitalId: number) => {
    if (isReadOnly) {
      return;
    }
    const input = fileInputRefs.current.get(hospitalId);
    if (!input) {
      return;
    }
    input.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("医院封面管理", "Hospital Cover Management")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tr("正在加载医院列表...", "Loading hospitals...")}
          </div>
        ) : errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : hospitals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tr("暂无医院数据。", "No hospitals available.")}
          </p>
        ) : (
          <div className="space-y-3">
            {hospitals.map(hospital => {
              const presentation = getHospitalImageCardPresentation({
                lang,
                hospital,
              });
              const imageUrl = hospital.imageUrl?.trim();

              return (
                <div
                  key={hospital.id}
                  className="border border-admin-border rounded-xl p-3 flex flex-col gap-3 md:flex-row md:items-start"
                >
                  <div className="w-full h-28 rounded-lg overflow-hidden bg-admin-surface-muted flex items-center justify-center md:w-44 md:h-28 md:flex-shrink-0">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={presentation.imageAlt}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {tr("暂无封面", "No cover image")}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <p className="font-semibold text-foreground">
                      {presentation.title}
                    </p>
                    {presentation.city ? (
                      <p className="text-sm text-muted-foreground">
                        {presentation.city}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <input
                        ref={el => {
                          if (el) {
                            fileInputRefs.current.set(hospital.id, el);
                          } else {
                            fileInputRefs.current.delete(hospital.id);
                          }
                        }}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          handleUpload(hospital.id, file ?? null);
                          event.currentTarget.value = "";
                        }}
                        disabled={isReadOnly || uploadState.isPending}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isReadOnly || uploadState.isPending}
                        onClick={() => openFilePicker(hospital.id)}
                      >
                        <UploadCloud
                          className="h-4 w-4 mr-1.5"
                          aria-hidden="true"
                        />
                        {tr("上传新封面", "Upload cover")}
                      </Button>
                      {imageUrl ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            clearState.clearHospitalImage(hospital.id)
                          }
                          disabled={isReadOnly || clearState.isPending}
                        >
                          <Trash2
                            className="h-4 w-4 mr-1.5"
                            aria-hidden="true"
                          />
                          {tr("清空封面", "Clear cover")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
