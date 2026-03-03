type CachedAccessToken = {
  token: string;
  expiresAt: Date;
};

const patientAccessTokenCache = new Map<number, CachedAccessToken>();

export function setCachedPatientAccessToken(
  appointmentId: number,
  token: string,
  expiresAt: Date
) {
  patientAccessTokenCache.set(appointmentId, {
    token,
    expiresAt,
  });
}

export function getCachedPatientAccessToken(
  appointmentId: number
): CachedAccessToken | null {
  const cached = patientAccessTokenCache.get(appointmentId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt.getTime() <= Date.now()) {
    patientAccessTokenCache.delete(appointmentId);
    return null;
  }

  return cached;
}

export function clearCachedPatientAccessToken(appointmentId: number) {
  patientAccessTokenCache.delete(appointmentId);
}
