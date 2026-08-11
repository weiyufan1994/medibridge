export type RequestMetadata = {
  clientIp: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  host: string | null;
  protocol: string | null;
  requestId: string | null;
  userAgent: string | null;
};
