import "../server/_core/loadEnv";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

function createVerificationContext(): TrpcContext {
  const req = {
    headers: {},
  } as TrpcContext["req"];

  const res = {} as TrpcContext["res"];

  return {
    req,
    res,
    user: null,
    userId: null,
    deviceId: null,
  };
}

async function main() {
  const caller = appRouter.createCaller(createVerificationContext());

  const hospitals = await caller.hospitals.getAll();
  const searchResults = await caller.doctors.search({
    keywords: ["心内科"],
    limit: 5,
    lang: "zh",
  });
  const recommendationResults = await caller.doctors.recommend({
    keywords: ["胸痛", "心悸"],
    summary: "最近反复胸痛并伴有心悸，想找合适的医生。",
    limit: 5,
  });

  console.log(
    JSON.stringify(
      {
        hospitals: {
          count: hospitals.length,
          sample: hospitals.slice(0, 3).map(item => ({
            id: item.id,
            name: item.name,
          })),
        },
        doctorSearch: {
          count: searchResults.length,
          sample: searchResults.slice(0, 3).map(item => ({
            doctorId: item.doctor.id,
            doctorName: item.doctor.name,
            department: item.department.name,
            hospital: item.hospital.name,
          })),
        },
        doctorRecommend: {
          count: recommendationResults.length,
          sample: recommendationResults.slice(0, 3).map(item => ({
            doctorId: item.doctor.id,
            doctorName: item.doctor.name,
            department: item.department.name,
            hospital: item.hospital.name,
            recommendationScore: item.doctor.recommendationScore,
          })),
        },
      },
      null,
      2
    )
  );
}

main().catch(error => {
  console.error("[verify-doctors-postgres] failed", error);
  process.exit(1);
});
