'use client';

import { LivePositionMarker } from '@/components/map/LivePositionMarker';
import { useSmoothedLngLat } from '@/hooks/useSmoothedLngLat';

export type OpsLiveVehicle = {
  employeeId: string;
  employeeName: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  routeId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
  presence: 'online' | 'stale';
};

type LiveVehicleMarkerProps = {
  vehicle: OpsLiveVehicle;
  onSelect: (vehicle: OpsLiveVehicle) => void;
};

/** Um pin por veículo — hook de interpolação isolado por instância. */
export function LiveVehicleMarker({ vehicle, onSelect }: LiveVehicleMarkerProps) {
  const smoothed = useSmoothedLngLat(
    {
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      heading: vehicle.heading ?? null,
    },
    3000,
  );

  if (!smoothed) return null;

  return (
    <LivePositionMarker
      latitude={smoothed.latitude}
      longitude={smoothed.longitude}
      kind="car"
      heading={smoothed.heading}
      accuracyMeters={vehicle.accuracy}
      plate={vehicle.vehiclePlate}
      stale={vehicle.presence === 'stale'}
      label={`${vehicle.employeeName} · ${vehicle.vehiclePlate ?? 'sem placa'}`}
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onSelect(vehicle);
      }}
    />
  );
}
