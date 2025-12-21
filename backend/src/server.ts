import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import { authRouter } from "./routes/auth";
import { mappingRouter } from "./routes/mapping";
import { employeesRouter } from "./routes/employees";
import { usersRouter } from "./routes/users";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
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

app.listen(CONFIG.PORT, () => {
  console.log(`Backend server listening on http://localhost:${CONFIG.PORT}`);
});
