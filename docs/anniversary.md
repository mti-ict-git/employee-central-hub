## Anniversary Feature PRD

### Overview
- Feature goal: Track employee birthdays and work anniversaries, surface upcoming milestones, and preview notification emails.
- Current entry point: Employee Management → Anniversaries in sidebar.
- Related areas: Anniversaries page, Email Template Preview page, and Settings → Anniversaries preferences.

### Objectives
- Provide a clear, filterable view of upcoming anniversaries by week and month.
- Highlight “Today” anniversaries prominently.
- Let HR/Managers preview email templates for birthdays, work anniversaries, and advance reminders.
- Offer configurable notification preferences and HR recipient lists.

### Non-Goals
- Sending emails from the frontend.
- Editing employee profile data from the Anniversaries page.

### Primary Users
- HR team members who monitor milestones and send announcements.
- Managers who plan team celebrations.
- Employees who receive notification emails.

### High-Level UX Flow
- User opens Anniversaries from Employee Management.
- User filters by type and department, then reviews Week/Month/History tabs.
- User opens Email Templates to preview birthday/work/advance reminder emails for different recipients.
- User configures notification settings in Settings → Anniversaries.

### Wireframe Descriptions (Shadcn UI)
- Anniversaries page
  - Header: Title, subtitle, and “Email Templates” button.
  - Filters: Type Select, Department Select.
  - Tabs: This Week, This Month, History.
  - List: Card with stacked rows (avatar icon, name, department, badge, date).
- Email Template Preview
  - Controls: Recipient Select, Desktop/Mobile toggle, “Mockup” badge.
  - Tabs: Birthday, Work Anniversary, Advance Reminder.
  - Preview Card: Simulated email header and body.
- Settings → Anniversaries
  - Notification type toggles (birthday, work).
  - Timing controls (on-day switch, advance reminder slider).
  - HR recipient list with add/remove input.

### Component Tree
- Web (Shadcn UI + TailwindCSS)
  - MainLayout
    - PageHeader
      - Button (Email Templates)
    - FiltersRow
      - Select (Type)
      - Select (Department)
    - Tabs
      - TabsList / TabsTrigger
      - TabsContent
        - Card
          - CardHeader / CardContent
            - AnniversaryRow (Badge, icon, date)
    - EmailTemplatePreview
      - Select (Recipient)
      - ToggleGroup (Desktop/Mobile)
      - Tabs (Birthday/Work/Reminder)
      - Card (Email mock)
- Mobile (React Native Paper/Tamagui)
  - Screen
    - Appbar
    - SegmentedButtons (Week/Month/History)
    - ChipGroup (Type, Department)
    - FlatList (AnniversaryRow)
    - FAB (Email Templates)

### Responsive Layout Guidelines
- Breakpoints: sm 640, md 768, lg 1024, xl 1280.
- Layout
  - Header stack on mobile, side-by-side on md+.
  - Filters wrap into two rows on mobile.
- Grid pattern
  - Use 12-column grid for cards and panels.

```tsx
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-6">...</div>
  <div className="col-span-12 md:col-span-6">...</div>
</div>
```

### Accessibility (WCAG 2.1)
- Ensure text contrast for badges and icons.
- Provide visible focus states for tabs, buttons, and selects.
- Use semantic headings and ARIA labels for toggles.
- Avoid color-only status indicators; pair with text.

### Data Model
- AnniversaryEntry
  - id: string
  - employeeId: string
  - name: string
  - department: string
  - type: "birthday" | "work"
  - date: ISO date string
  - yearsInService: number | null

### Backend Endpoints (Proposed)
- GET /api/anniversaries
  - Query: type, department, range=week|month|history, timezone
  - Response: { items: AnniversaryEntry[] }
- GET /api/anniversaries/preview
  - Query: template=birthday|work|reminder, recipient=employee|manager|hr
  - Response: { subject: string, html: string }
- GET /api/anniversaries/settings
  - Response: { birthdayEnabled, workEnabled, onDay, advanceDays, hrRecipients }
- PUT /api/anniversaries/settings
  - Body: { birthdayEnabled, workEnabled, onDay, advanceDays, hrRecipients }
  - Response: { ok: true }
- POST /api/anniversaries/dispatch
  - Body: { date, dryRun }
  - Response: { sent: number, skipped: number }

### Backend Sample Implementation (Express)

```ts
import { Router } from "express";
import type { Request, Response } from "express";

type AnniversaryType = "birthday" | "work";

type AnniversaryEntry = {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  type: AnniversaryType;
  date: string;
  yearsInService: number | null;
};

const router = Router();

router.get("/anniversaries", async (req: Request, res: Response) => {
  const range = String(req.query.range || "week");
  const type = String(req.query.type || "all");
  const department = String(req.query.department || "all");
  const items: AnniversaryEntry[] = [];
  res.json({ items, range, type, department });
});

router.get("/anniversaries/settings", async (_req: Request, res: Response) => {
  res.json({
    birthdayEnabled: true,
    workEnabled: true,
    onDay: true,
    advanceDays: 7,
    hrRecipients: ["hr-notifications@merdekagroup.com"],
  });
});

router.put("/anniversaries/settings", async (req: Request, res: Response) => {
  const body = req.body as {
    birthdayEnabled: boolean;
    workEnabled: boolean;
    onDay: boolean;
    advanceDays: number;
    hrRecipients: string[];
  };
  res.json({ ok: true, saved: body });
});

export default router;
```

### Sample Web UI (React + Shadcn UI)

```tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AnniversaryType = "birthday" | "work";

type AnniversaryEntry = {
  id: string;
  name: string;
  department: string;
  type: AnniversaryType;
  date: string;
  yearsInService: number | null;
};

export function AnniversaryList() {
  const [items, setItems] = useState<AnniversaryEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  useEffect(() => {
    const url = `/api/anniversaries?range=week&type=${typeFilter}&department=${deptFilter}`;
    fetch(url, { credentials: "include" })
      .then((res) => res.json())
      .then((data: { items: AnniversaryEntry[] }) => setItems(data.items));
  }, [typeFilter, deptFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>This Week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="birthday">Birthday</SelectItem>
              <SelectItem value="work">Work Anniversary</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="Engineering">Engineering</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Tabs defaultValue="week">
          <TabsList>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="week">
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.department}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{item.date}</div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

### Sample Mobile UI (React Native Paper)

```tsx
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Appbar, Chip, SegmentedButtons, Text, Card } from "react-native-paper";

type AnniversaryEntry = {
  id: string;
  name: string;
  department: string;
  type: "birthday" | "work";
  date: string;
};

export function AnniversariesScreen() {
  const [items, setItems] = useState<AnniversaryEntry[]>([]);
  const [range, setRange] = useState("week");
  const [type, setType] = useState("all");

  useEffect(() => {
    const url = `/api/anniversaries?range=${range}&type=${type}`;
    fetch(url)
      .then((res) => res.json())
      .then((data: { items: AnniversaryEntry[] }) => setItems(data.items));
  }, [range, type]);

  return (
    <View style={{ flex: 1 }}>
      <Appbar.Header>
        <Appbar.Content title="Anniversaries" />
      </Appbar.Header>
      <View style={{ padding: 16, gap: 12 }}>
        <SegmentedButtons
          value={range}
          onValueChange={setRange}
          buttons={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "history", label: "History" },
          ]}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip selected={type === "all"} onPress={() => setType("all")}>All</Chip>
          <Chip selected={type === "birthday"} onPress={() => setType("birthday")}>Birthday</Chip>
          <Chip selected={type === "work"} onPress={() => setType("work")}>Work</Chip>
        </View>
        {items.map((item) => (
          <Card key={item.id} style={{ padding: 12 }}>
            <Text variant="titleSmall">{item.name}</Text>
            <Text variant="bodySmall">{item.department} · {item.date}</Text>
          </Card>
        ))}
      </View>
    </View>
  );
}
```

### Theming
- Web: Tailwind CSS with CSS variables for primary, background, and muted text.
- Mobile: React Native Paper theme with color palette aligned to web tokens.

### Acceptance Criteria
- Anniversaries list supports type and department filters.
- Week/Month/History tabs show relevant results and empty states.
- Email template preview supports recipient and device view.
- Settings → Anniversaries saves preferences and validates HR emails.

### Edge Cases
- Employees with missing department or join date.
- Multiple anniversaries on the same day.
- No results in a range.

### Metrics
- Emails sent per type and recipient.
- Weekly active users for Anniversaries page.
- Settings save success rate.
