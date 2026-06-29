import { EVENT_TYPES } from '@baseline/events';
import type { GoogleCalendarEvent } from './client';

interface EventRow {
  userId: string;
  source: string;
  sourceId: string;
  eventType: string;
  occurredAt: Date;
  durationMs: number;
  payload: Record<string, unknown>;
}

// All-day events have no real duration; count each as a fixed block so a single
// "PTO"/"Birthday" doesn't swallow a whole day's budget. Tune as needed.
const ALL_DAY_BLOCK_MS = 8 * 60 * 60 * 1000;

export function normalizeCalendarEvents(
  events: GoogleCalendarEvent[],
  userId: string,
  calendarName: string,
): EventRow[] {
  const rows: EventRow[] = [];

  for (const e of events) {
    if (!e.id || e.status === 'cancelled') continue;

    // Skip events the user explicitly declined.
    const self = e.attendees?.find((a) => a.self);
    if (self?.responseStatus === 'declined') continue;

    let occurredAt: Date;
    let durationMs: number;
    let allDay = false;

    if (e.start?.dateTime && e.end?.dateTime) {
      occurredAt = new Date(e.start.dateTime);
      durationMs = Math.max(0, new Date(e.end.dateTime).getTime() - occurredAt.getTime());
    } else if (e.start?.date) {
      // All-day: anchor at the date's midnight (UTC) and count a fixed block.
      allDay = true;
      occurredAt = new Date(`${e.start.date}T00:00:00Z`);
      durationMs = ALL_DAY_BLOCK_MS;
    } else {
      continue; // no usable time window
    }

    rows.push({
      userId,
      source: 'google_calendar',
      sourceId: e.id,
      eventType: EVENT_TYPES.GCAL_EVENT,
      occurredAt,
      durationMs,
      payload: {
        category: calendarName, // time-allocation groups by this
        summary: e.summary ?? '(no title)',
        description: e.description,
        html_link: e.htmlLink,
        all_day: allDay,
        attendee_count: e.attendees?.length ?? 0,
        status: e.status,
        end: e.end?.dateTime ?? e.end?.date,
      },
    });
  }

  return rows;
}
