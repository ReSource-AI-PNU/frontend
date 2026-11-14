import complexesJson from "../../data/complexes.json";
import type { IndustrialComplex } from "./domain";

export const COMPLEXES = complexesJson as IndustrialComplex[];

export function findComplex(id: string) {
  return COMPLEXES.find((c) => c.id === id) ?? null;
}

export function buildingsUrl(id: string) {
  return `/data/buildings/${id}.geojson`;
}
