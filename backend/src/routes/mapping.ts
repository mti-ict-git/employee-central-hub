import { Router } from "express";
import path from "path";
import fs from "fs";

export const mappingRouter = Router();

mappingRouter.get("/dbinfo", (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "scripts", "dbinfo-mapping.json");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "DBINFO_MAPPING_NOT_FOUND" });
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "FAILED_TO_READ_DBINFO";
    return res.status(500).json({ error: message });
  }
});
