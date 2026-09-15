import type { ReferralLang } from "@/features/referrals/copy";
import { getReferralCopy } from "@/features/referrals/copy";
import { formatReferralDateTime } from "@/features/referrals/presentation";
import type { ReferralProgressUpdate } from "@/features/referrals/progressPresentation";

type ReferralProgressUpdateHistoryProps = {
  lang: ReferralLang;
  latestUpdate: Omit<ReferralProgressUpdate, "id">;
  previousUpdates: readonly ReferralProgressUpdate[];
};

export function ReferralProgressUpdateHistory({
  lang,
  latestUpdate,
  previousUpdates,
}: ReferralProgressUpdateHistoryProps) {
  const copy = getReferralCopy(lang);

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
        <p>{latestUpdate.text}</p>
        {latestUpdate.updatedAt ? (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            {copy.orderDetail.latestUpdateTime}:{" "}
            {formatReferralDateTime(latestUpdate.updatedAt, lang)}
          </p>
        ) : null}
      </div>

      {previousUpdates.length > 0 ? (
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {copy.orderDetail.previousUpdates}
          </p>
          {previousUpdates.map(update => (
            <div
              key={update.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700"
            >
              <p>{update.text}</p>
              {update.updatedAt ? (
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {copy.orderDetail.latestUpdateTime}:{" "}
                  {formatReferralDateTime(update.updatedAt, lang)}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
