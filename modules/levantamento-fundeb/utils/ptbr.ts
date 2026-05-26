function looksLikeMojibake(value: string) {
  return /Ã.|â.|�|ï¿½/.test(value);
}

const COMMON_REPAIRS: Array<[RegExp, string]> = [
  [/\u001d/g, "”"],
  [/\u009d/g, "”"],
  [/�S/g, "“"],
  [/�T/g, "”"],
  [/�guas/g, "Águas"],
  [/\ufffdguas/g, "Águas"],
  [/Luzi�nia/g, "Luziânia"],
  [/Luzi\ufffdnia/g, "Luziânia"],
  [/Valpara�so/g, "Valparaíso"],
  [/Valpara\ufffdso/g, "Valparaíso"],
  [/Goi�s/g, "Goiás"],
  [/Goi\ufffds/g, "Goiás"],
  [/Bras�lia/g, "Brasília"],
  [/Bras\ufffdlia/g, "Brasília"],
  [/regi�o/g, "região"],
  [/regi\ufffdo/g, "região"],
  [/intermedi�ria/g, "intermediária"],
  [/intermedi\ufffdria/g, "intermediária"],
  [/microrregi�o/g, "microrregião"],
  [/microrregi\ufffdo/g, "microrregião"],
  [/munic�pio/g, "município"],
  [/munic�pios/g, "municípios"],
  [/munic\ufffdpio/g, "município"],
  [/munic\ufffdpios/g, "municípios"],
  [/complementa��o/g, "complementação"],
  [/Complementa��o/g, "Complementação"],
  [/complementa\ufffd\ufffdo/g, "complementação"],
  [/Complementa\ufffd\ufffdo/g, "Complementação"],
  [/sensa��o/g, "sensação"],
  [/sensa\ufffd\ufffdo/g, "sensação"],
  [/popula��o/g, "população"],
  [/popula\ufffd\ufffdo/g, "população"],
  [/exerc�cio/g, "exercício"],
  [/exerc\ufffdcio/g, "exercício"],
  [/t�cnico/g, "técnico"],
  [/T�cnico/g, "Técnico"],
  [/t\ufffdcnico/g, "técnico"],
  [/T\ufffdcnico/g, "Técnico"],
  [/n�o/g, "não"],
  [/N�o/g, "Não"],
  [/n\ufffdo/g, "não"],
  [/N\ufffdo/g, "Não"],
  [/j�/g, "já"],
  [/J�/g, "Já"],
  [/j\ufffd/g, "já"],
  [/J\ufffd/g, "Já"],
  [/est\ufffd/g, "está"],
  [/Est\ufffd/g, "Está"],
  [/Uni�o/g, "União"],
  [/Uni\ufffdo/g, "União"],
  [/Crit�rio/g, "Critério"],
  [/crit�rio/g, "critério"],
  [/Crit\ufffdrio/g, "Critério"],
  [/crit\ufffdrio/g, "critério"],
];

function applyCommonRepairs(value: string) {
  let text = value;

  for (const [pattern, replacement] of COMMON_REPAIRS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

export function repairPtBrText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  let text = value.replace(/\u00a0/g, " ").replace(/[\u0000-\u0008\u000b-\u001c\u001e-\u001f\u007f]/g, " ").trim();

  for (let index = 0; index < 3; index += 1) {
    if (!looksLikeMojibake(text)) {
      break;
    }

    try {
      const repaired = Buffer.from(text, "latin1").toString("utf8");
      if (repaired && repaired !== text) {
        text = repaired;
        continue;
      }
    } catch {
      break;
    }

    break;
  }

  text = applyCommonRepairs(text);

  return text.replace(/\s+/g, " ").trim();
}

export function normalizePtBrText(value: string | null | undefined) {
  return repairPtBrText(value);
}

export function normalizePtBrDeep<T>(value: T): T {
  if (typeof value === "string") {
    return normalizePtBrText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePtBrDeep(item)) as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
      key,
      normalizePtBrDeep(entryValue),
    ]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}
