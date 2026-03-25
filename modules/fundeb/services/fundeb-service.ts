import type { FundebIndicator } from "@/modules/fundeb/types/fundeb";

const indicators: FundebIndicator[] = [
  { id: "ind_1", label: "Prestacao no prazo", value: "94%" },
  { id: "ind_2", label: "Municipios assessorados", value: "27" },
  { id: "ind_3", label: "Pendencias criticas", value: "2" },
];

export function listFundebIndicators() {
  return indicators;
}
