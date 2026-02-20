import { createApp } from "./app";
import { env } from "./env";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend listening on http://localhost:${env.PORT}`);
});
