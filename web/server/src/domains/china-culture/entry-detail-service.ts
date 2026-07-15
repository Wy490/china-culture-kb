import { fail, success, ErrorCodes } from '@shared/types.js';
import type { ApiResponse, EntryDetail } from '@shared/types.js';
import {
  convertChinaCultureFullEntryDetail as convertFullEntryDetail,
  getChinaCultureEntryDetail as mcpGetEntryDetail,
} from './knowledge-source-adapter.js';

/**
 * Resolve a China Culture knowledge-base entry by its canonical name.
 *
 * Keeping this adapter inside the Domain Pack prevents the platform entry
 * route from depending on the legacy, culture-specific entry service.
 */
export async function getChinaCultureEntryDetailByName(
  name: string,
): Promise<ApiResponse<EntryDetail>> {
  const detail = await mcpGetEntryDetail(name);
  if (!detail) {
    return fail(ErrorCodes.ENTRY_NOT_FOUND, `Entry "${name}" not found`);
  }
  return success(convertFullEntryDetail(detail));
}
