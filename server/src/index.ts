import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();
const PORT = parseInt(process.env.PORT || "3001");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
});

app.use(cors());
app.use(express.json());

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        nickname VARCHAR(50) NOT NULL,
        score INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Database ready");
  } catch (err) {
    console.error("Database init failed:", err);
    process.exit(1);
  }
}

app.get("/api/scores", async (_req, res) => {
  try {
    const limit = Math.min(parseInt(_req.query.limit as string) || 20, 100);
    const result = await pool.query(
      "SELECT nickname, score FROM leaderboard ORDER BY score DESC, created_at ASC LIMIT $1",
      [limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/scores error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/scores", async (req, res) => {
  try {
    const { nickname, score } = req.body;

    if (!nickname || typeof nickname !== "string") {
      return res.status(400).json({ error: "Nickname is required" });
    }
    const cleanName = nickname.trim().slice(0, 20);
    if (cleanName.length < 1) {
      return res.status(400).json({ error: "Nickname must be at least 1 character" });
    }

    if (!score || typeof score !== "number" || score <= 0 || !Number.isInteger(score)) {
      return res.status(400).json({ error: "Score must be a positive integer" });
    }

    const result = await pool.query(
      "INSERT INTO leaderboard (nickname, score) VALUES ($1, $2) RETURNING id, nickname, score, created_at",
      [cleanName, score]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("POST /api/scores error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Leaderboard server running on http://localhost:${PORT}`);
  });
});
