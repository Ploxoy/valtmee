# Project Ideas

## Complaints Section

A future user-generated content feature for collecting public complaints without turning the main dashboard into a noisy feed.

### Product Positioning

The complaints section should be separate from the calm daily dashboard.

Recommended routes:

- `/klachten` - public complaint submission form
- `/admin/klachten` - moderation queue
- `/api/complaints` - complaint submission and approved complaint reads

The homepage should not show raw complaints. If complaints are shown on the dashboard at all, use only a compact aggregate widget:

```text
KLACHTEN
12 vandaag
spoor · files · benzine
```

This keeps the homepage useful and prevents it from becoming a negativity feed.

### MVP Flow

1. User submits a complaint through `/klachten`.
2. Complaint is stored with status `pending`.
3. Moderator reviews it in `/admin/klachten`.
4. Moderator approves or rejects it.
5. Only `approved` complaints can appear publicly.

### Suggested Statuses

```text
pending
approved
rejected
archived
```

### Suggested Data Model

```ts
type Complaint = {
  id: string;
  text: string;
  category: "file" | "spoor" | "weer" | "benzine" | "overheid" | "anders";
  city?: string;
  province?: string;
  sourcePage?: string;
  status: "pending" | "approved" | "rejected" | "archived";
  createdAt: string;
  moderatedAt?: string;
  rejectionReason?: string;
  ipHash?: string;
};
```

### Moderation

Premoderation is required. Public surfaces must only read `approved` complaints.

Minimal admin actions:

- approve
- reject

Possible later rejection reasons:

- spam
- duplicate
- abusive
- not relevant

### Storage

Do not store complaints in local files on Vercel.

Preferred storage:

- Vercel Postgres / Neon for a normal relational table
- Supabase if built-in auth and dashboard tools are useful

Avoid Vercel KV for the first version because statuses, filtering, moderation queues, and aggregates are easier in SQL.

### Abuse Protection

Minimum safeguards for MVP:

- honeypot field
- rate limit by `ipHash`
- max 3-5 complaints per source per day
- text length limit, for example 10-280 characters
- public display only after moderation

### Privacy

Do not collect names or email addresses in the first version.

Optional location should be coarse only:

- city
- province

Do not collect exact geolocation for complaints.

### Widget Strategy

Start without a homepage widget until there is real data.

When there is enough data, add a small aggregate widget rather than individual complaints:

- number of approved complaints today
- top categories
- maybe one neutral summary line

Individual approved complaints can live on `/klachten`, not on the homepage.

## Feature Ideas for Development

1. **Widget Selection**: Enable users to choose and customize widgets on their dashboard.

2. **Traffic Jams on Map**: Integrate a map provider to display traffic congestion on the map.

3. **Widget Ideas**:
   - Weather widget with local forecasts
   - Fuel price comparison widget
   - Traffic alerts widget
   - Parking availability widget
   - Public transport schedules widget
   - Local events widget
   - Emergency services locator widget
   - Roadwork notifications widget
