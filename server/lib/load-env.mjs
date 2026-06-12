export function loadLocalEnv(filePath = ".env") {
  if (typeof process.loadEnvFile !== "function") {
    return false;
  }

  try {
    process.loadEnvFile(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
