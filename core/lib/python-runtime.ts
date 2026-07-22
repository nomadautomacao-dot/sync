import fs from "node:fs";
import path from "node:path";

interface PythonCommand {
  command: string;
  argsPrefix: string[];
}

function existingPath(candidate: string) {
  return fs.existsSync(candidate) ? candidate : null;
}

function getWindowsCandidates() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const userProfile = process.env.USERPROFILE || "";

  return [
    process.env.PYTHON_BIN || "",
    path.join(localAppData, "Programs", "Python", "Python313", "python.exe"),
    path.join(localAppData, "Programs", "Python", "Python312", "python.exe"),
    path.join(localAppData, "Programs", "Python", "Python311", "python.exe"),
    path.join(localAppData, "Programs", "Python", "Python310", "python.exe"),
    path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python313", "python.exe"),
    path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python312", "python.exe"),
    path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python311", "python.exe"),
    path.join(userProfile, "AppData", "Local", "Programs", "Python", "Python310", "python.exe"),
  ].filter(Boolean);
}

export function resolvePythonCommand(): PythonCommand {
  if (process.platform === "win32") {
    for (const candidate of getWindowsCandidates()) {
      const resolved = existingPath(candidate);
      if (resolved) {
        return { command: resolved, argsPrefix: [] };
      }
    }

    // Python Launcher is common on Windows when PATH is configured.
    return { command: "py", argsPrefix: ["-3"] };
  }

  return {
    command: process.env.PYTHON_BIN || "python3",
    argsPrefix: [],
  };
}
