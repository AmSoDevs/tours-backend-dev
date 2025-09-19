import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { notFoundHandler } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { apiRouter } from "./routes";
import { config } from "./config";

export const app: Application = express();

// Core middleware
app.use(helmet());
const corsOptions = {
  origin: config.cors.frontendUrls,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Healthcheck
app.get("/health", (_req, res) => {
	res.status(200).json({ status: "ok" });
});

// API v1
app.use("/api/v1", apiRouter);

// 404 and error handling
app.use(notFoundHandler);
app.use(errorHandler);
