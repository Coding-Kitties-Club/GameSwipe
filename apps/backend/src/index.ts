import express from "express";
import cors from "cors";
import "./env"

const app = express();


app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
    res.status(200).json({
        ok: true,
        service: "gameswipe-backend",
        time: new Date().toISOString()
    });
});

const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
})