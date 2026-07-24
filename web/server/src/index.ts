import express from 'express';
import cors from 'cors';
import { createCorsOptions } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { createJsonBodyParser } from './middleware/json-body.js';
import { entriesRouter } from './routes/entries.js';
import { storiesRouter } from './routes/stories.js';
import { systemRouter } from './routes/system.js';
import { outlineRouter } from './routes/outline.js';
import { projectsRouter } from './routes/projects.js';
import { gearsCallbackRouter } from './routes/gears-callback.js';
import { stage6RevisionsRouter } from './routes/stage6-revisions.js';
import { stage7GoldenCardsRouter } from './routes/stage7-golden-cards.js';
import { stage8BlindReviewRouter } from './routes/stage8-blind-review.js';
import { referenceLibraryRouter } from './routes/reference-library.js';
import { storyAgentRouter } from './routes/story-agent.js';
import {
  initializeStoryStorageRootEnvironment,
  storyGeneratedRoot,
  storyKbRoot,
} from './platform/story-storage-root.js';

// Resolve both roots once before the server accepts traffic. Production starts
// fail closed unless operators explicitly provide two absolute, disjoint roots.
initializeStoryStorageRootEnvironment();

const app = express();

// Middleware
app.use(cors(createCorsOptions()));
app.use(createJsonBodyParser());

// Routes
app.use('/api/entries', entriesRouter);
app.use('/api/stories', storiesRouter);
app.use('/api/system', systemRouter);
app.use('/api/story-outline', outlineRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/gears-callback', gearsCallbackRouter);
app.use('/api/stage6-revisions', stage6RevisionsRouter);
app.use('/api/stage7-golden-cards', stage7GoldenCardsRouter);
app.use('/api/stage8-blind-review', stage8BlindReviewRouter);
app.use('/api/reference-library', referenceLibraryRouter);
app.use('/api/story-agent', storyAgentRouter);

// Unified error handler (must be after all routes)
app.use(errorHandler);

// Start server
const PORT = Number(process.env.PORT ?? 3000);

app.listen(PORT, () => {
  console.log(
    `china-culture-kb server running on http://localhost:${PORT} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`,
  );
  console.log(`KB_ROOT=${storyKbRoot()}`);
  console.log(`WEB_GENERATED_ROOT=${storyGeneratedRoot()}`);
});
