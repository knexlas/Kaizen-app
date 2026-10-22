import Toybox.Application;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

var gStore = null;

// Foreground state: the feed published by the Kaizen web app, plus actions waiting to be sent back.
//
// Feed shape (see src/domains/lean/watchFeed.js):
//   blocks:   [{ i: blockId, k: taskId, t: title, p: project, d: yyyymmdd, s: start minute, m: minutes, x: done }]
//   backlog:  [{ k, t, p, m, b: blocked }]                       this week's unscheduled tasks
//   projects: [{ n: name, o: open, c: done, tasks: [{ k, t, b: "blocker titles", n: blocks count, m }] }]
//   alerts:   ["epoch|blockId|start|title", ...]
class Store {
    var data = null;
    var lastSync = null;   // epoch seconds
    var status = "";
    var queue = [];
    var sending = false;

    function initialize() {
        data = Application.Storage.getValue("feed");
        var q = Application.Storage.getValue("queue");
        queue = (q == null) ? [] : q;
        lastSync = Application.Storage.getValue("lastSync");
    }

    // ---------- time ----------

    function dayInt(offset) {
        var m = Time.today().add(new Time.Duration(offset * 86400 + 43200));
        var i = Gregorian.info(m, Time.FORMAT_SHORT);
        return i.year * 10000 + i.month * 100 + i.day;
    }

    function nowMin() {
        var c = System.getClockTime();
        return c.hour * 60 + c.min;
    }

    function dayLabel(offset) {
        if (offset == 0) {
            return "Today";
        }
        if (offset == 1) {
            return "Tomorrow";
        }
        var m = Time.today().add(new Time.Duration(offset * 86400 + 43200));
        var i = Gregorian.info(m, Time.FORMAT_MEDIUM);
        return i.day_of_week + " " + i.day;
    }

    // ---------- reading ----------

    function list(name) {
        if (data == null || data[name] == null) {
            return [];
        }
        return data[name];
    }

    // Blocks of one day, sorted by start.
    function blocksFor(day) {
        var all = list("blocks");
        var out = [];
        for (var i = 0; i < all.size(); i++) {
            if (all[i]["d"] == day) {
                var j = out.size();
                out.add(all[i]);
                while (j > 0 && out[j - 1]["s"] > all[i]["s"]) {
                    out[j] = out[j - 1];
                    j -= 1;
                }
                out[j] = all[i];
            }
        }
        return out;
    }

    function current() {
        var now = nowMin();
        var blocks = blocksFor(dayInt(0));
        for (var i = 0; i < blocks.size(); i++) {
            var b = blocks[i];
            if (!b["x"] && b["s"] <= now && now < b["s"] + b["m"]) {
                return b;
            }
        }
        return null;
    }

    function upcoming() {
        var now = nowMin();
        var blocks = blocksFor(dayInt(0));
        for (var i = 0; i < blocks.size(); i++) {
            if (!blocks[i]["x"] && blocks[i]["s"] > now) {
                return blocks[i];
            }
        }
        return null;
    }

    // [done, total] for a day
    function dayStats(day) {
        var blocks = blocksFor(day);
        var done = 0;
        for (var i = 0; i < blocks.size(); i++) {
            if (blocks[i]["x"]) {
                done += 1;
            }
        }
        return [done, blocks.size()];
    }

    function blockedCount() {
        var count = 0;
        var projects = list("projects");
        for (var i = 0; i < projects.size(); i++) {
            var tasks = projects[i]["tasks"];
            for (var j = 0; j < tasks.size(); j++) {
                if (tasks[j]["b"] != null && tasks[j]["b"].length() > 0) {
                    count += 1;
                }
            }
        }
        return count;
    }

    function syncLabel() {
        if (status.length() > 0) {
            return status;
        }
        if (lastSync == null) {
            return "Not synced";
        }
        var ago = (Time.now().value() - lastSync) / 60;
        var pending = (queue.size() > 0) ? " · " + queue.size() + " to send" : "";
        return ((ago < 1) ? "Synced now" : "Synced " + ago + "m ago") + pending;
    }

    // ---------- sync ----------

    function fetch() {
        var key = Sync.watchKey();
        if (key.length() == 0) {
            status = "Add code in Garmin Connect";
            WatchUi.requestUpdate();
            return;
        }
        status = "Syncing..";
        WatchUi.requestUpdate();
        Communications.makeWebRequest(
            Sync.getUrl(key, ["day", "blocks", "backlog", "projects", "alerts"]),
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onFeed)
        );
    }

    function onFeed(code, resp) {
        if (code == 200 && resp instanceof Dictionary) {
            data = Sync.decodeFields(resp["fields"]);
            lastSync = Time.now().value();
            status = "";
            Application.Storage.setValue("feed", data);
            Application.Storage.setValue("alerts", data["alerts"]);
            Application.Storage.setValue("lastSync", lastSync);
            reapplyQueue();
            scheduleReminders();
            flush();
        } else if (code == 404) {
            status = "Code not found";
        } else if (code == Communications.BLE_CONNECTION_UNAVAILABLE || code == Communications.BLE_HOST_TIMEOUT) {
            status = "Phone not connected";
        } else {
            status = "Sync failed (" + code + ")";
        }
        WatchUi.requestUpdate();
    }

    function scheduleReminders() {
        Sync.scheduleNext(Sync.nextAlertAfter(list("alerts"), Time.now().value() + 60, Application.Storage.getValue("skip")));
    }

    // ---------- actions ----------

    // a: "done" | "undo" | "snooze" | "start" on a time block
    function blockAction(a, b) {
        var ev = { "a" => a, "k" => b["k"], "d" => b["d"], "s" => b["s"] };
        if (b["i"] != null && b["i"].length() > 0) {
            ev["i"] = b["i"];
        }
        if (a.equals("snooze")) {
            ev["n"] = 15;
        } else if (a.equals("start")) {
            ev["n"] = (nowMin() / 5) * 5;
        }
        remember(b["i"] + "|" + b["s"]);
        applyLocal(ev);
        enqueue(ev);
    }

    // a: "done" | "today" on a task from a project or the week backlog
    function taskAction(a, k) {
        var ev = { "a" => a, "k" => k };
        applyLocal(ev);
        enqueue(ev);
    }

    // Optimistic update so the watch reflects the action before the web app confirms it.
    function applyLocal(ev) {
        var a = ev["a"];
        var blocks = list("blocks");
        for (var i = 0; i < blocks.size(); i++) {
            var b = blocks[i];
            var sameBlock = ev["i"] != null && ev["i"].length() > 0 && ev["i"].equals(b["i"]);
            var sameTask = ev["i"] == null && ev["k"] != null && ev["k"].equals(b["k"]);
            if (!sameBlock && !sameTask) {
                continue;
            }
            if (a.equals("done")) {
                b["x"] = true;
            } else if (a.equals("undo")) {
                b["x"] = false;
            } else if (a.equals("snooze") && sameBlock) {
                b["s"] = b["s"] + ev["n"];
            } else if (a.equals("start") && sameBlock) {
                b["s"] = ev["n"];
            }
        }
        if (ev["i"] == null && (a.equals("done") || a.equals("today"))) {
            removeTask(ev["k"], a.equals("done"));
        }
        if (data != null) {
            Application.Storage.setValue("feed", data);
        }
    }

    // Drop a task from the backlog (and from projects when it is done).
    function removeTask(k, fromProjects) {
        var backlog = list("backlog");
        for (var i = backlog.size() - 1; i >= 0; i--) {
            if (k.equals(backlog[i]["k"])) {
                backlog.remove(backlog[i]);
            }
        }
        if (!fromProjects) {
            return;
        }
        var projects = list("projects");
        for (var p = 0; p < projects.size(); p++) {
            var tasks = projects[p]["tasks"];
            for (var j = tasks.size() - 1; j >= 0; j--) {
                if (k.equals(tasks[j]["k"])) {
                    tasks.remove(tasks[j]);
                    projects[p]["o"] = projects[p]["o"] - 1;
                    projects[p]["c"] = projects[p]["c"] + 1;
                }
            }
        }
    }

    // A fresh feed may predate actions still queued, or sent but not yet applied by the web app
    // (it applies them only while open): replay those on top. Sent snoozes/starts are not replayed
    // because they are not idempotent.
    function reapplyQueue() {
        var sent = Application.Storage.getValue("sent");
        if (sent != null) {
            var cutoff = (Time.now().value() - 3600).toLong() * 1000l;
            for (var i = 0; i < sent.size(); i++) {
                var a = sent[i]["a"];
                if (sent[i]["at"] > cutoff && (a.equals("done") || a.equals("undo") || a.equals("today"))) {
                    applyLocal(sent[i]);
                }
            }
        }
        for (var j = 0; j < queue.size(); j++) {
            applyLocal(queue[j]);
        }
    }

    // Blocks acted on here, so the background reminder does not buzz for them again.
    function remember(blockKey) {
        var skip = Application.Storage.getValue("skip");
        if (skip == null) {
            skip = [];
        }
        skip.add(blockKey);
        if (skip.size() > 20) {
            skip = skip.slice(skip.size() - 20, null);
        }
        Application.Storage.setValue("skip", skip);
    }

    function enqueue(ev) {
        ev["at"] = Time.now().value().toLong() * 1000l;
        queue.add(ev);
        Application.Storage.setValue("queue", queue);
        flush();
        WatchUi.requestUpdate();
    }

    function flush() {
        var key = Sync.watchKey();
        if (sending || queue.size() == 0 || key.length() == 0) {
            return;
        }
        sending = true;
        Communications.makeWebRequest(
            Sync.eventsUrl(key),
            { "fields" => typed(queue[0]) },
            {
                :method => Communications.HTTP_REQUEST_METHOD_POST,
                :headers => { "Content-Type" => Communications.REQUEST_CONTENT_TYPE_JSON },
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onSent)
        );
    }

    function onSent(code, resp) {
        sending = false;
        if (code == 200) {
            var sent = Application.Storage.getValue("sent");
            sent = (sent == null) ? [] : sent;
            sent.add(queue[0]);
            if (sent.size() > 10) {
                sent = sent.slice(sent.size() - 10, null);
            }
            Application.Storage.setValue("sent", sent);
            queue = queue.slice(1, null);
            Application.Storage.setValue("queue", queue);
            flush();
        }
        WatchUi.requestUpdate();
    }

    // Plain event -> Firestore typed fields.
    function typed(ev) {
        var out = {};
        var keys = ev.keys();
        for (var i = 0; i < keys.size(); i++) {
            var v = ev[keys[i]];
            if (v == null) {
                continue;
            }
            if (v instanceof String) {
                out[keys[i]] = { "stringValue" => v };
            } else {
                out[keys[i]] = { "integerValue" => v.toString() };
            }
        }
        return out;
    }
}
