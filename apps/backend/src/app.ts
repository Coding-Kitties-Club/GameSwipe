import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { healthRouter } from "./routes/health";
import { roomsRouter } from "./routes/rooms";
import { errorHandler } from "./middleware/errorHandler";
import { steamRouter } from "./routes/steam";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json());
  app.use(cookieParser());

  app.use(
    "/rooms/join",
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: true,
      legacyHeaders: false
    })
  );

  app.use(healthRouter);
  app.use(roomsRouter);
  app.use(steamRouter);

  app.use(errorHandler);
  return app;
}
