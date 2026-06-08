import express from 'express';
import cors from 'cors';
import { resolve } from 'node:path';
import { createCorsOptions } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { entriesRouter } from './routes/entries.js';
import { storiesRouter } from './routes/stories.js';
import { systemRouter } from './routes/system.js';
import { outlineRouter } from './routes/outline.js';

// Default KB_ROOT to ../../data (relative to this file → project root /data)
if (!process.env.KB_ROOT) {
  process.env.KB_ROOT = resolve(import.meta.dirname, '..', '..', '..', 'data');
}

const app = express();

// Middleware
app.use(cors(createCorsOptions()));
app.use(express.json());

// Routes
app.use('/api/entries', entriesRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/system', systemRouter);
app.use('/api/story-outline', outlineRouter);

// Unified error handler (must be after all routes)
app.use(errorHandler);

// Start server
const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(
    `china-culture-kb server running on http://localhost:${PORT} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`,
  );
  console.log(`KB_ROOT=${process.env.KB_ROOT}`);
});