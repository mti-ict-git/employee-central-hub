import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { canAccessReport, canExportReport } from "../policy";

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

reportsRouter.get("/:id", (req, res) => {
  const roles = req.user?.roles || [];
  if (!roles.some((r) => canAccessReport(r))) return res.status(403).json({ error: "FORBIDDEN_REPORT_ACCESS" });
  const id = String(req.params.id || "");
  return res.json({ id, data: [] });
});

reportsRouter.get("/:id/export", (req, res) => {
  const roles = req.user?.roles || [];
  if (!roles.some((r) => canExportReport(r))) return res.status(403).json({ error: "FORBIDDEN_REPORT_EXPORT" });
  const id = String(req.params.id || "");
  return res.json({ id, url: `/downloads/report-${id}.csv` });
});
