import express from "express";
import "dotenv/config";
import { AppDataSource } from "./database/data-source";
import { authRoutes } from "./routes/auth.routes";

const app = express();

app.use(express.json());
app.use("/auth", authRoutes);

app.get("/", (request, response) => {
  return response.json({
    message: "MedClinic API is running",
  });
});

const PORT = Number(process.env.PORT) || 3000;

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to database:", error);
  });