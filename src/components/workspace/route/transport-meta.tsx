import { Bus, Car, Footprints, Plane, Sailboat, TrainFront } from "lucide-react";
import { TRANSPORT_META, type TransportMode } from "@/lib/schemas";

/** Lucide icon per transport mode. Text metadata lives in `TRANSPORT_META`. */
export const TRANSPORT_ICON: Record<TransportMode, typeof Plane> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  cab: Car,
  boat: Sailboat,
  walk: Footprints,
};

/** Ordered list for pickers: [mode, label, Icon]. */
export const TRANSPORT_OPTIONS = (
  Object.keys(TRANSPORT_META) as TransportMode[]
).map((mode) => ({
  mode,
  label: TRANSPORT_META[mode].label,
  Icon: TRANSPORT_ICON[mode],
}));
