import express from "express";

const app = express();

app.use(express.json());

app.get("/", (request, response) => {
  return response.json({
    message: "MedClinic API is running"
  });
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});