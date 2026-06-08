// web/server/src/routes/entries.ts — Entry search, match & detail routes

import { Router } from 'express';
import { validateQuery, validateBody } from '../middleware/validate.js';
import { EntrySearchQuerySchema, EntryDetailQuerySchema, EntryMatchRequestSchema } from '@shared/schemas.js';
import { searchEntries, getEntryDetailByName, matchEntries } from '../services/entry-service.js';

export const entriesRouter = Router();

// GET /api/entries/search — search entries by keywords, type, province, region
entriesRouter.get('/search', validateQuery(EntrySearchQuerySchema), async (req, res, next) => {
  try {
    const result = await searchEntries(req.query as any);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/entries/match — smart topic matching for story creation
entriesRouter.post('/match', validateBody(EntryMatchRequestSchema), async (req, res, next) => {
  try {
    const { query, limit, preferred_province, preferred_type } = req.body;
    const result = await matchEntries({ query, limit: limit ?? 5, preferred_province, preferred_type });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/entries/detail — get full entry detail by name
entriesRouter.get('/detail', validateQuery(EntryDetailQuerySchema), async (req, res, next) => {
  try {
    const { name } = req.query as { name: string };
    const result = await getEntryDetailByName(name);
    res.status(result.ok ? 200 : 404).json(result);
  } catch (err) {
    next(err);
  }
});