export abstract class IpAnonymizer {
  abstract anonymize(ipAddress?: string | null): string | null;
}
