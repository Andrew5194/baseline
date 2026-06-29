const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarEvent {
  id: string;
  status?: string; // 'confirmed' | 'tentative' | 'cancelled'
  summary?: string;
  description?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: Array<{ email?: string; self?: boolean; responseStatus?: string; organizer?: boolean }>;
  organizer?: { email?: string; self?: boolean };
  recurringEventId?: string;
}

// The primary calendar's metadata — its `summary` (display name) becomes the
// time-allocation category for its events.
export async function fetchPrimaryCalendar(token: string): Promise<{ id: string; summary: string }> {
  const res = await fetch(`${CALENDAR_API}/calendars/primary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('GOOGLE_TOKEN_INVALID');
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status} ${await res.text()}`);
  const d = await res.json();
  return { id: d.id, summary: d.summary || 'Calendar' };
}

// Fetch primary-calendar events with `start` in [since, now]. singleEvents=true
// expands recurring series into individual instances (each with a stable id, so
// they dedupe cleanly). Follows nextPageToken pagination.
export async function fetchCalendarEvents(token: string, since: Date): Promise<GoogleCalendarEvent[]> {
  const events: GoogleCalendarEvent[] = [];
  const timeMin = since.toISOString();
  const timeMax = new Date().toISOString(); // only ingest events up to now (time spent)
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      showDeleted: 'false',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) throw new Error('GOOGLE_TOKEN_INVALID');
    if (!res.ok) throw new Error(`Google Calendar API error: ${res.status} ${await res.text()}`);

    const data = await res.json();
    events.push(...((data.items as GoogleCalendarEvent[]) ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}
