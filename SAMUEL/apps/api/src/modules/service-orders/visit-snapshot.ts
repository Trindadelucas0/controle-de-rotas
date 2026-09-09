export type CustomerAddressPin = {
  id: string;
  name: string;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function customerHasPin(
  customer: Pick<CustomerAddressPin, 'latitude' | 'longitude'>,
): customer is { latitude: number; longitude: number } {
  return customer.latitude != null && customer.longitude != null;
}

export function visitAddressSnapshot(customer: CustomerAddressPin) {
  return {
    street: customer.street,
    number: customer.number,
    complement: customer.complement,
    district: customer.district,
    city: customer.city,
    state: customer.state,
    zipCode: customer.zipCode,
    latitude: customer.latitude as number,
    longitude: customer.longitude as number,
  };
}
