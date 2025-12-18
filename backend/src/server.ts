import express from "express";
import cors from "cors";
import { CONFIG } from "./config";
import { authRouter } from "./routes/auth";

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: CONFIG.FRONTEND_URL,
    credentials: true,
  })
);

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);

app.listen(CONFIG.PORT, () => {
  console.log(`Backend server listening on http://localhost:${CONFIG.PORT}`);
});