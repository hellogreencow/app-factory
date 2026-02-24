#!/usr/bin/env node
/**
 * Feature Builder — transforms template shells into real apps.
 *
 * After template-copy + customize gives us a themed skeleton, this agent
 * uses the code-agent in a directed loop to implement actual features:
 *   - Edit/delete (not just add)
 *   - Real computed views (trends, streaks, weekly summaries)
 *   - Meaningful empty states with guidance
 *   - Settings that actually work (theme toggle, data export, clear data)
 *   - Micro-interactions (confirmations, haptics descriptions, transitions)
 *
 * Usage: node feature-builder.js <appDir> <ideaJson>
 */

require('./lib/env').loadEnv();

const fs = require('fs');
const path = require('path');
const { chat } = require('./lib/llm');
const { runCodeAgent } = require('./code-agent');

const MODEL = process.env.FEATURE_BUILDER_MODEL || 'google/gemini-3-flash-preview';
const CODE_MODEL = process.env.CODE_MODEL || 'google/gemini-3-flash-preview';

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  process.stdout.write(`[${ts}] [feature-builder] ${msg}\n`);
}

const ARCH_FEATURE_SPECS = {
  tracker: [
    {
      name: 'edit-delete',
      task: `Add edit and delete functionality to entries.

The context (TrackerContext.js) already exports deleteEntry(date) and updateEntry(date, note, mood).
Read the context file first to confirm, then edit DayEntryScreen:

- If editing an existing entry (existing !== null), pre-fill the form AND show a red "Delete" button
- The delete button should show Alert.alert confirmation (import { Alert } from 'react-native')
- After delete, call deleteEntry(date) and nav.goBack()
- Change the save button text to "Update" when editing, call updateEntry instead of addEntry
- The Save/Update button should still call addEntry for new entries

Preserve all testID and accessibilityLabel attributes. Add testID="delete-entry" to the delete button.`,
    },
    {
      name: 'weekly-view',
      task: `Add a 7-day mini summary to the CalendarScreen showing the last 7 days as a horizontal row of mood indicators.

Below the stats row (streak + entries), add a "This Week" section:
- Show the last 7 days as small circles in a row
- Each circle shows the first letter of the mood (G, O, M, etc.) or is empty/gray if no entry
- Color the circles based on mood: great=green, good=blue, okay=amber, meh=gray
- Below the row, show a one-line summary like "5 of 7 days logged — mostly good"

Use only View, Text, and existing StyleSheet patterns. No new dependencies.
Keep all existing testID/accessibilityLabel attributes. Add testID="weekly-summary" to the container.`,
    },
    {
      name: 'real-stats',
      task: `Upgrade StatsScreen from a basic counter page to an insights dashboard.

The context (TrackerContext.js) already provides: streak, longestStreak, totalEntries,
moodCounts (object with great/good/okay/meh counts), weekEntries (last 7 days array).
Read the context file first to see the full API.

Add these sections to StatsScreen (using only View/Text, no chart libraries):

1. "Trend" section: Compare this week vs last week using weekEntries + entries.
   Count mood entries for last 7 days vs the 7 before. Show an arrow (unicode)
   up/down/flat with text like "Better week than last" or "Holding steady".
   If < 7 entries total, show "Keep logging to see trends".

2. "Longest Streak" — use longestStreak from context. Display alongside current streak.

3. "Weekly Pattern" — use weekEntries from context. Show a row of day abbreviations
   with a colored circle: green=great, blue=good, amber=okay, gray=meh, empty=no entry.

4. "Total days since first entry" counter — compute from Object.keys(entries).

Preserve existing mood breakdown bar chart. Add testID="stat-trend", testID="stat-longest".`,
    },
    {
      name: 'working-settings',
      task: `Make SettingsScreen actually functional.

The context already exports clearAll() and prefs/savePrefs for reminders.
Read TrackerContext.js first to confirm the API.

Rewrite SettingsScreen with:

1. "Export Data" button — import { Share, Alert } from 'react-native'. Use Share.share()
   with all entries formatted as one line per entry: "2024-01-15: good - Had a great day"

2. "Clear All Data" button — shows Alert.alert confirmation, then calls clearAll() from context

3. "Reminders" row — use prefs.reminders from context. On press, call
   savePrefs({...prefs, reminders: !prefs.reminders}). Show "On"/"Off".

4. Show actual entry count: "{totalEntries} entries logged"

Add testID="export-btn", testID="clear-btn", testID="reminder-toggle".
Import { useTracker } from '../context/TrackerContext'. Keep dark theme styles.`,
    },
    {
      name: 'empty-states',
      task: `Add meaningful empty states throughout the app.

1. CalendarScreen: When there are 0 entries, instead of showing an empty calendar grid,
   show a welcoming message: a large friendly heading like "Start your first day" with a
   subtitle that explains what the app does in one sentence, and a prominent "Log Today" button.
   When entries exist, show the normal view.

2. StatsScreen: When there are fewer than 3 entries, show a gentle message like
   "Log a few more days to unlock insights" with a subtle illustration (just use
   large emoji or unicode symbols as decorative elements).

Keep existing code for the populated states. Wrap them in conditional renders.
Add testID="empty-calendar" and testID="empty-stats".`,
    },
  ],

  dashboard: [
    {
      name: 'edit-delete',
      task: `Add edit and delete to dashboard entries.

MetricsContext already exports deleteEntry(id) and updateEntry(id, value, label).
Read the context file first to confirm.

In HistoryScreen:
- Import { Alert, TouchableOpacity } from 'react-native'
- Make each entry row tappable (wrap in TouchableOpacity)
- On press, show Alert.alert with title "Edit Entry" and 3 buttons:
  "Edit" -> Alert.prompt to change value, calls updateEntry(id, newValue)
  "Delete" -> calls deleteEntry(id)
  "Cancel" -> dismiss
- Add a subtle "Tap to edit" text below the heading
- Add testID={\`entry-row-\${entry.id}\`} on tappable rows

In OverviewScreen:
- After adding an entry, briefly change button text to "Added!" for 1.5s (use setTimeout + state)`,
    },
    {
      name: 'goals',
      task: `Add a goal-setting feature to the dashboard.

MetricsContext already exports goal (number|null), setGoal(value), and progress (0-100|null).
Read the context file first to confirm.

In OverviewScreen:
- If goal is set and progress is not null, show a progress bar below the metrics grid:
  a gray track (height 8, borderRadius 4) with a colored fill (width=progress%)
  Below: text showing either "X away from your goal" or "Goal reached!" (green)
- Add a "Set Goal" button: on press, Alert.prompt("Set Target", "Enter target value",
  [{text:"Cancel"}, {text:"Set", onPress: v => setGoal(v)}])
- If no goal, show a subtle "Set a target?" link instead of the bar

Add testID="goal-progress" and testID="set-goal-btn".`,
    },
    {
      name: 'real-stats',
      task: `Upgrade OverviewScreen metrics to show computed insights.

MetricsContext exports: avg, best (object with date+value), weekEntries (last 7 days), streak.
Read the context file first to confirm.

Add to OverviewScreen below existing metrics:

1. "Best Day" card — show best.date and best.value. testID="metric-best"
2. "This Week" card — compute the avg of weekEntries that have entries.
   Compare to overall avg. Show arrow up/down. testID="metric-trend"
3. Improve existing mini chart (if any): add day labels (M T W T F S S) below bars

No new dependencies. Keep all existing elements.`,
    },
    {
      name: 'working-settings',
      task: `Make SettingsScreen functional.

MetricsContext exports clearAll(). Read the context file to confirm.

Rewrite SettingsScreen with:
1. "Export Data" — import { Share, Alert } from 'react-native'. Share.share() with
   entries formatted as "date: value (label)" one per line
2. "Clear All Data" — Alert.alert confirmation then clearAll()
3. "Unit Label" row — cycles through ['', 'kg', 'lbs', 'km', 'mi', 'hrs', '$']
   on press. Store in AsyncStorage (@dashboard_unit). Use useState+useEffect to load/save.
4. Entry count: "{entries.length} entries logged"

Import { useMetrics } from '../context/MetricsContext'.
Add testID="export-btn", testID="clear-btn", testID="unit-selector".`,
    },
    {
      name: 'empty-states',
      task: `Add empty states.

OverviewScreen with 0 entries: Show a welcoming card explaining what to track,
with a prominent "Log your first entry" button. Hide the chart and metrics grid.

HistoryScreen with 0 entries: Show "Your history will appear here" with a subtle
prompt to go add an entry.

Add testID="empty-overview" and testID="empty-history".`,
    },
  ],

  feed: [
    {
      name: 'interactions',
      task: `Upgrade the feed with real interactions.

FeedContext already exports deletePost(id) and username.
Read the context file first to confirm.

In FeedScreen:
1. Add onLongPress to each post item. On long press, show Alert.alert with:
   - "Copy" -> Clipboard or just skip if no Clipboard available
   - "Delete" (only if post.author === username or === 'You') -> confirm then deletePost(id)
   - "Cancel"
2. Add a relative timestamp helper: function timeAgo(ts) that returns
   "just now" / "5m ago" / "2h ago" / "yesterday" / formatted date.
   Display it below each post's author name.

In ComposeScreen:
3. Add a character counter showing {text.length}/280
4. Disable the Post button when text is empty or > 280 chars
5. Style the counter red when > 260 chars

Add testID="char-count" for counter. Preserve all existing testIDs.`,
    },
    {
      name: 'search-filter',
      task: `Add search and filtering to the feed.

FeedContext exports: posts, userPosts, likedPosts.

In FeedScreen, above the posts list:
1. Add a TextInput search bar that filters posts by body or author (case-insensitive)
2. Below search, add 3 filter chips as TouchableOpacity: "All", "Mine", "Liked"
   - "All": show all posts (filtered by search)
   - "Mine": show userPosts (from context)
   - "Liked": show likedPosts (from context)
   Active chip gets highlighted background. Use useState for active filter.
3. Apply search AND filter together. Show "{count} posts" below filters.

Add testID="search-feed", testID="filter-all", testID="filter-mine", testID="filter-liked".`,
    },
    {
      name: 'profile-depth',
      task: `Make ProfileScreen a real profile page.

FeedContext exports: username, setUsername, userPosts, likesGiven, likesReceived.
Read the context to confirm.

In ProfileScreen:
1. Show username as a heading. Add a small "edit" text next to it.
   On press, Alert.prompt("Display Name", "Enter your name",
   [{text:"Cancel"}, {text:"Save", onPress: v => setUsername(v)}])
2. Stats row with 3 cards: "Posts" (userPosts.length), "Likes Received" (likesReceived),
   "Likes Given" (likesGiven)
3. "Your Recent Posts" section — FlatList of userPosts.slice(0, 5).
   Each shows first 80 chars of body + relative time (reuse timeAgo if available,
   or write a simple one)

Add testID="edit-name", testID="stat-given", testID="recent-posts".`,
    },
    {
      name: 'working-settings',
      task: `Make SettingsScreen functional.

FeedContext exports clearAll() and posts.
Read the context to confirm.

Rewrite SettingsScreen with:
1. "Export Posts" — Share.share() with userPosts formatted as "body (timestamp)"
2. "Clear All Posts" — Alert.alert confirmation then clearAll()
3. "{posts.length} posts" display
4. Brief "About" text section

Import { useFeed } from '../context/FeedContext'.
Import { Share, Alert } from 'react-native'.
Add testID="export-btn", testID="clear-btn".`,
    },
    {
      name: 'empty-states',
      task: `Add empty states.

FeedScreen with no posts: Show a creative prompt to write the first post.
ProfileScreen with no user posts: Show "Share your first thought" with the compose button.
Liked filter with no results: "Like some posts to see them here"

Add testID="empty-feed", testID="empty-profile", testID="empty-liked".`,
    },
  ],

  reference: [
    {
      name: 'real-search',
      task: `Upgrade BrowseScreen search to be fully functional.

ReferenceContext already exports: search, setSearch, filtered, categories, activeCategory,
setActiveCategory. The filtering already works (title, body, category).
Read the context to confirm.

In BrowseScreen:
1. If not already present, add a TextInput bound to search/setSearch
2. Below search, show category chips using categories array. On press, setActiveCategory(cat).
   Highlight the active one.
3. Show result count: "{filtered.length} of {items.length} items"
4. If filtered.length === 0, show "No items match your search" with testID="no-results"

Add testID="search-results-count", testID={\`category-chip-\${cat}\`} on each chip.`,
    },
    {
      name: 'item-depth',
      task: `Make ItemDetailScreen a real content page.

ReferenceContext exports getRelated(id, limit) and markRead(id). Read the context.

In ItemDetailScreen:
1. On mount, call markRead(item.id) to track reading
2. Show category as a colored badge/chip at the top
3. Show reading time: Math.max(1, Math.ceil(item.body.split(/\\s+/).length / 200)) + " min read"
4. Make the bookmark button prominent (large, clear toggle state)
5. Add a Share button: import { Share } from 'react-native', Share.share({message: item.title + '\\n\\n' + item.body})
6. At the bottom, "Related" section: getRelated(item.id, 3).map() -> tappable items

Add testID="related-items", testID="reading-time", testID="share-btn".`,
    },
    {
      name: 'bookmarks-depth',
      task: `Make BookmarksScreen more useful.

ReferenceContext exports bookmarked (already sorted by bookmarkedAt) and clearBookmarks().
Read the context.

In BookmarksScreen:
1. Show count: "{bookmarked.length} bookmarked"
2. If bookmarked.length === 0, show empty state: "Bookmark items to find them quickly"
   with testID="empty-bookmarks"
3. On long-press of a bookmark, Alert.alert with "Remove Bookmark?" -> toggleBookmark(id)
4. Each item shows title + category badge

Add testID="bookmark-count".`,
    },
    {
      name: 'working-settings',
      task: `Make SettingsScreen functional.

ReferenceContext exports clearBookmarks(), items, bookmarked, readCount.

Rewrite SettingsScreen with:
1. "Export Bookmarks" — Share.share with bookmarked items' titles joined by newline
2. "Clear Bookmarks" — Alert confirmation then clearBookmarks()
3. "{items.length} items" display
4. "Read: {readCount} items" display

Import { useReference } from '../context/ReferenceContext'.
Import { Share, Alert } from 'react-native'.
Add testID="export-btn", testID="clear-bookmarks", testID="read-count".`,
    },
  ],

  generic: [
    {
      name: 'edit-delete',
      task: `Add edit and delete to items.

ItemsContext already exports updateItem(id, name, value) and removeItem(id).
Read the context to confirm.

In DetailScreen:
- Add "Edit" button that navigates to AddItem with route params: {item: currentItem}
- Add "Delete" button with Alert.alert confirmation -> removeItem(item.id) -> nav.goBack()
- Add testID="edit-item", testID="delete-item"

In AddItemScreen:
- Check route.params?.item. If present, pre-fill name and value fields.
- Change title to "Edit Item" when editing.
- On save: if editing, call updateItem(item.id, name, value), else addItem(name, value)
- Then nav.goBack()

In ListScreen:
- Add onLongPress to each item -> Alert with "Delete" option -> removeItem(id)`,
    },
    {
      name: 'sorting-search',
      task: `Add sorting and search to ListScreen.

ItemsContext exports sorted (pre-sorted array), sortMode, setSortMode.
Read the context to confirm the sort modes: 'newest', 'oldest', 'az', 'za'.

In ListScreen:
1. Add a TextInput search bar. Filter 'sorted' by name (case-insensitive) using local state.
2. Add a sort toggle TouchableOpacity that cycles through modes on press:
   newest -> oldest -> az -> za -> newest. Show current mode as text.
3. Show "{filtered.length} items" count
4. If no results after search, show "No items match" with testID="empty-search"

Add testID="search-items", testID="sort-toggle", testID="item-count".`,
    },
    {
      name: 'detail-depth',
      task: `Make DetailScreen a proper display page.

Items already have createdAt (timestamp). Read the context to confirm.

In DetailScreen:
1. Large heading with item.name
2. Value displayed prominently below
3. Creation date formatted nicely (new Date(item.createdAt).toLocaleDateString())
4. Share button: import { Share } from 'react-native', Share.share({message: item.name + ': ' + item.value})
5. If Edit/Delete buttons not already present, add them (see edit-delete feature)

Add testID="item-date", testID="share-item".`,
    },
    {
      name: 'working-settings',
      task: `Make SettingsScreen functional.

ItemsContext exports clearAll() and items.
Read the context to confirm.

Rewrite SettingsScreen with:
1. "Export Items" — Share.share with items formatted as "name: value" one per line
2. "Clear All Items" — Alert confirmation then clearAll()
3. "{items.length} items" display
4. "Default Sort" row — show current sortMode, on press cycle to next

Import { useItems } from '../context/ItemsContext'.
Import { Share, Alert } from 'react-native'.
Add testID="export-btn", testID="clear-btn".`,
    },
  ],
};

async function generateCustomFeatures(idea, arch) {
  const prompt = `You are designing features for a mobile app.

APP: "${idea.name}" — ${idea.description}
Architecture: ${arch}
Domain: ${idea.domain}

The app already has basic screens (list/add/detail/settings or equivalent).
Generate 2 domain-specific feature tasks that would make this app genuinely useful.

Each task should be a detailed code edit instruction (like you would give a developer).
Focus on features that are UNIQUE to this domain — not generic CRUD operations.

Examples of good domain-specific features:
- A recipe app: ingredient scaling calculator, cooking timer, substitution suggestions
- A reading tracker: page progress bar, reading speed estimate, genre distribution
- A habit tracker: streak calendar heatmap, habit completion rate, skip reason tracking

Output a JSON array of exactly 2 objects:
[
  { "name": "short-name", "task": "Detailed multi-paragraph task description..." },
  { "name": "short-name", "task": "Detailed multi-paragraph task description..." }
]

Rules for task descriptions:
- Be extremely specific about what to add and where
- Reference actual file names (App.js, src/screens/*, src/context/*)
- Specify testID values for new interactive elements
- Only use React Native built-ins (View, Text, TouchableOpacity, Alert, Share, etc.)
- Do NOT add new npm dependencies
- Keep changes within the existing code patterns

Output ONLY the JSON array. No markdown.`;

  try {
    const raw = await chat([{ role: 'user', content: prompt }], {
      model: MODEL,
      temperature: 0.7,
      max_tokens: 2000,
      timeout: 30_000,
    });

    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const features = JSON.parse(match[0]);
    return Array.isArray(features) ? features.slice(0, 2) : [];
  } catch (e) {
    log(`Custom feature generation failed: ${e.message}`);
    return [];
  }
}

async function run(appDir, idea, opts = {}) {
  const arch = idea.architecture || 'generic';
  const features = ARCH_FEATURE_SPECS[arch] || ARCH_FEATURE_SPECS.generic;
  const onProgress = opts.onProgress || (() => {});
  const model = opts.model || CODE_MODEL;

  log(`Building features for ${idea.name} (${arch}): ${features.length} base features`);

  const results = [];
  const t0 = Date.now();

  for (let i = 0; i < features.length; i++) {
    const feat = features[i];
    const label = `[${i + 1}/${features.length}] ${feat.name}`;
    log(`${label}: starting...`);
    onProgress(`Building feature: ${feat.name}`);

    const r = await runCodeAgent({
      appDir,
      task: feat.task,
      idea,
      model,
      maxSteps: 12,
      onProgress: (msg) => log(`${label}: ${msg}`),
    });

    results.push({
      name: feat.name,
      ok: r.ok,
      filesChanged: r.filesChanged || [],
      summary: r.summary || '',
      error: r.ok ? null : r.error,
    });

    if (!r.ok) {
      log(`${label}: FAILED — ${r.error || 'unknown error'}`);
    } else {
      log(`${label}: done (${r.filesChanged.length} files changed)`);
    }
  }

  // Generate + build 1-2 domain-specific features
  if (!opts.skipCustom) {
    log('Generating domain-specific features...');
    onProgress('Designing unique features...');
    const customFeatures = await generateCustomFeatures(idea, arch);

    for (let i = 0; i < customFeatures.length; i++) {
      const feat = customFeatures[i];
      const label = `[custom ${i + 1}/${customFeatures.length}] ${feat.name}`;
      log(`${label}: starting...`);
      onProgress(`Building: ${feat.name}`);

      const r = await runCodeAgent({
        appDir,
        task: feat.task,
        idea,
        model,
        maxSteps: 10,
        onProgress: (msg) => log(`${label}: ${msg}`),
      });

      results.push({
        name: `custom:${feat.name}`,
        ok: r.ok,
        filesChanged: r.filesChanged || [],
        summary: r.summary || '',
        error: r.ok ? null : r.error,
      });

      if (!r.ok) log(`${label}: FAILED — ${r.error}`);
      else log(`${label}: done (${r.filesChanged.length} files)`);
    }
  }

  const dur = ((Date.now() - t0) / 1000).toFixed(1);
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  log(`Done in ${dur}s: ${passed} features built, ${failed} failed`);

  return {
    ok: failed === 0,
    duration: dur,
    features: results,
    passed,
    failed,
  };
}

async function main() {
  const appDir = process.argv[2];
  const ideaRaw = process.argv[3];

  if (!appDir || !fs.existsSync(appDir)) {
    console.error('Usage: feature-builder.js <appDir> <ideaJson>');
    process.exit(1);
  }

  let idea;
  try {
    idea = JSON.parse(ideaRaw);
  } catch {
    const fp = path.join(appDir, 'features.json');
    if (fs.existsSync(fp)) {
      idea = JSON.parse(fs.readFileSync(fp, 'utf8'));
    } else {
      console.error('Need idea JSON as arg or features.json in app dir');
      process.exit(1);
    }
  }

  const result = await run(appDir, idea);
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main().catch(e => {
    log(`Fatal: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { run };
