/**
 * A lista branca de `ambiente.js` decide se o servidor sobe — e ela é o tipo de
 * código que só falha na máquina do outro. Montada com `HOME` e `TMPDIR`, ela
 * funcionava no Mac e produzia, no Windows, um app que abre e não emite PDF:
 * sem `SystemRoot` o Chromium do Playwright não chega a iniciar.
 *
 * Por isso os testes passam a plataforma como argumento em vez de olhar
 * `process.platform`: as duas plataformas ficam cobertas rodando em qualquer
 * uma das duas.
 */

import { describe, expect, it } from "vitest";

import { variaveisDoSistema } from "./ambiente";

const AMBIENTE_WINDOWS = {
  PATH: "C:\\Windows\\system32",
  SystemRoot: "C:\\Windows",
  windir: "C:\\Windows",
  TEMP: "C:\\Users\\ana\\AppData\\Local\\Temp",
  TMP: "C:\\Users\\ana\\AppData\\Local\\Temp",
  USERPROFILE: "C:\\Users\\ana",
  APPDATA: "C:\\Users\\ana\\AppData\\Roaming",
  LOCALAPPDATA: "C:\\Users\\ana\\AppData\\Local",
  COMSPEC: "C:\\Windows\\system32\\cmd.exe",
  // O que a lista branca existe para barrar.
  FIREBASE_SERVICE_ACCOUNT: "{...}",
  NODE_TLS_REJECT_UNAUTHORIZED: "0",
};

const AMBIENTE_MAC = {
  PATH: "/usr/bin:/bin",
  HOME: "/Users/ana",
  TMPDIR: "/var/folders/ana/T/",
  LANG: "pt_BR.UTF-8",
  NODE_TLS_REJECT_UNAUTHORIZED: "0",
};

describe("variaveisDoSistema", () => {
  it("leva ao Windows o que o Chromium exige para iniciar", () => {
    const env = variaveisDoSistema("win32", AMBIENTE_WINDOWS);

    // Sem estas o processo filho não chega ao primeiro `main()`.
    expect(env.SystemRoot).toBe("C:\\Windows");
    expect(env.TEMP).toBe("C:\\Users\\ana\\AppData\\Local\\Temp");
    expect(env.USERPROFILE).toBe("C:\\Users\\ana");
    expect(env.PATH).toBe("C:\\Windows\\system32");
  });

  it("não leva o par POSIX para o Windows nem o par Windows para o macOS", () => {
    const windows = variaveisDoSistema("win32", { ...AMBIENTE_WINDOWS, HOME: "/Users/ana", TMPDIR: "/tmp" });
    expect(windows.HOME).toBeUndefined();
    expect(windows.TMPDIR).toBeUndefined();

    const mac = variaveisDoSistema("darwin", { ...AMBIENTE_MAC, SystemRoot: "C:\\Windows" });
    expect(mac.SystemRoot).toBeUndefined();
    expect(mac.HOME).toBe("/Users/ana");
  });

  it("não herda credencial nem o desligamento de TLS em plataforma nenhuma", () => {
    for (const plataforma of ["win32", "darwin", "linux"]) {
      const env = variaveisDoSistema(plataforma, {
        ...AMBIENTE_WINDOWS,
        ...AMBIENTE_MAC,
        QEDU_TOKEN: "segredo",
      });
      expect(env.FIREBASE_SERVICE_ACCOUNT).toBeUndefined();
      expect(env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
      expect(env.QEDU_TOKEN).toBeUndefined();
    }
  });

  it("aceita `Path` quando o Windows entrega a chave nessa grafia", () => {
    const env = variaveisDoSistema("win32", { Path: "C:\\Windows\\system32", SystemRoot: "C:\\Windows" });
    expect(env.PATH).toBe("C:\\Windows\\system32");
  });

  it("preenche TMPDIR e LANG fora do Windows, e não os inventa dentro dele", () => {
    const mac = variaveisDoSistema("darwin", { PATH: "/usr/bin", HOME: "/Users/ana" });
    expect(mac.TMPDIR).toBe("/tmp");
    expect(mac.LANG).toBe("pt_BR.UTF-8");

    const windows = variaveisDoSistema("win32", { PATH: "C:\\Windows" });
    expect(windows.TMPDIR).toBeUndefined();
    expect(windows.LANG).toBeUndefined();
  });
});
