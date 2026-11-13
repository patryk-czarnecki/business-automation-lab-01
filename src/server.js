import app from "./app.js";
import { startRetryWorker } from "./workers/retryWorker.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  startRetryWorker();
  console.log("[RetryWorker] Started (interval: 10 seconds)");
});
