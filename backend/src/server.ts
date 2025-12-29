import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import { authRouter } from "./routes/auth";
import { mappingRouter } from "./routes/mapping";
import { employeesRouter } from "./routes/employees";
import { usersRouter } from "./routes/users";
import { reportsRouter } from "./routes/reports";
import { rbacRouter } from "./routes/rbac";
import { syncRouter } from "./routes/sync";
import { Router } from "express";
import { authMiddleware, requireRole } from "./middleware/auth";
import { can } from "./policy";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (CONFIG.CORS_ALLOW_ALL) return callback(null, true);
      if (!origin) return callback(null, true);
      const allowed = new Set([CONFIG.FRONTEND_URL, ...CONFIG.FRONTEND_URLS]);
      if (allowed.has(origin)) return callback(null, true);
      return callback(new Error(`CORS_NOT_ALLOWED: ${origin}`));
    },
    credentials: true,
  }),
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/mapping", mappingRouter);
app.use("/api/employees", employeesRouter);
app.use("/api/users", usersRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/rbac", rbacRouter);
app.use("/api/sync", syncRouter);

app.listen(CONFIG.PORT, () => {
  console.log(`Backend server listening on http://localhost:${CONFIG.PORT}`);
});
