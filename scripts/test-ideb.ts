import { getIdebMunicipalHistorico } from "./core/lib/ideb-municipal";
import { findGoviaMunicipio } from "./core/lib/govia-compat";

async function run() {
  const mun = await findGoviaMunicipio({ codigo_ibge: "2107308" });
  if (mun) {
    const hist = getIdebMunicipalHistorico("2107308");
    console.log(JSON.stringify(hist, null, 2));
  } else {
    console.log("Not found");
  }
}
run();
