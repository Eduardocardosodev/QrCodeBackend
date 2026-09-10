export type GeoLocation = {
  country: string | null;
  state: string | null;
  city: string | null;
};

export abstract class IpGeolocator {
  abstract locate(ipAddress?: string | null): GeoLocation | null;
}
