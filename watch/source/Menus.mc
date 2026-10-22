import Toybox.Lang;
import Toybox.WatchUi;

function push(view, delegate) {
    WatchUi.pushView(view, delegate, WatchUi.SLIDE_LEFT);
}

function openMainMenu() {
    var m = new MainMenu();
    push(m, new MainMenuDelegate(m));
}

function openDay(offset) {
    var m = new BlockListMenu(offset);
    push(m, new BlockListDelegate(m));
}

function openWeek() {
    var m = new WeekMenu();
    push(m, new WeekDelegate(m));
}

function openBacklog() {
    var m = new BacklogMenu();
    push(m, new TaskListDelegate(m));
}

function openProjects() {
    var m = new ProjectsMenu();
    push(m, new ProjectsDelegate(m));
}

// Menu2 that can rebuild its items in place after an action changes the data.
class RefreshMenu extends WatchUi.Menu2 {
    var count = 0;

    function initialize(title) {
        Menu2.initialize({ :title => title });
    }

    function clear() {
        while (count > 0) {
            count -= 1;
            deleteItem(count);
        }
    }

    function add(label, sub, id) {
        addItem(new WatchUi.MenuItem(label, sub, id, null));
        count += 1;
    }

    function rebuild() {
    }
}

// ---------- main menu ----------

class MainMenu extends RefreshMenu {
    var cur = null;
    var next = null;

    function initialize() {
        RefreshMenu.initialize("Kaizen");
        rebuild();
    }

    function rebuild() {
        clear();
        var store = $.gStore;
        cur = store.current();
        next = store.upcoming();
        if (cur != null) {
            add("Done", cur["t"], :curDone);
            add("Snooze 15 min", cur["t"], :curSnooze);
        } else if (next != null) {
            add("Start now", next["t"] + " (" + hhmm(next["s"]) + ")", :nextStart);
        }
        var stats = store.dayStats(store.dayInt(0));
        add("Today", stats[0].toString() + "/" + stats[1] + " done", :today);
        add("Week", store.list("backlog").size().toString() + " to schedule", :week);
        var blocked = store.blockedCount();
        add("Projects", store.list("projects").size().toString() + " active" + (blocked > 0 ? " · " + blocked + " blocked" : ""), :projects);
        add("Sync now", store.syncLabel(), :sync);
    }
}

class MainMenuDelegate extends WatchUi.Menu2InputDelegate {
    var menu;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item) {
        var id = item.getId();
        var store = $.gStore;
        if (id == :curDone && menu.cur != null) {
            store.blockAction("done", menu.cur);
            toast("Done: " + menu.cur["t"]);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (id == :curSnooze && menu.cur != null) {
            store.blockAction("snooze", menu.cur);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (id == :nextStart && menu.next != null) {
            store.blockAction("start", menu.next);
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        } else if (id == :today) {
            openDay(0);
        } else if (id == :week) {
            openWeek();
        } else if (id == :projects) {
            openProjects();
        } else if (id == :sync) {
            store.fetch();
            WatchUi.popView(WatchUi.SLIDE_RIGHT);
        }
    }
}

// ---------- time blocks ----------

class BlockListMenu extends RefreshMenu {
    var offset;
    var blocks = [];

    function initialize(dayOffset) {
        RefreshMenu.initialize("");
        offset = dayOffset;
        rebuild();
    }

    function rebuild() {
        clear();
        var store = $.gStore;
        blocks = store.blocksFor(store.dayInt(offset));
        var stats = store.dayStats(store.dayInt(offset));
        setTitle(store.dayLabel(offset) + " " + stats[0] + "/" + stats[1]);
        var now = store.nowMin();
        for (var i = 0; i < blocks.size(); i++) {
            var b = blocks[i];
            var sub;
            if (b["x"]) {
                sub = "done";
            } else if (offset == 0 && b["s"] <= now && now < b["s"] + b["m"]) {
                sub = "NOW · " + minsLabel(b["s"] + b["m"] - now) + " left";
            } else {
                sub = minsLabel(b["m"]) + (b["p"].length() > 0 && !b["p"].equals(b["t"]) ? " · " + b["p"] : "");
            }
            add(hhmm(b["s"]) + " " + b["t"], sub, i);
        }
        if (blocks.size() == 0) {
            add("Nothing planned", null, :none);
        }
    }
}

class BlockListDelegate extends WatchUi.Menu2InputDelegate {
    var menu;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id instanceof Number) {
            var block = menu.blocks[id];
            push(new BlockActionsMenu(block, menu.offset), new BlockActionsDelegate(block, menu));
        }
    }
}

class BlockActionsMenu extends WatchUi.Menu2 {
    function initialize(block, offset) {
        Menu2.initialize({ :title => block["t"] });
        if (block["x"]) {
            addItem(new WatchUi.MenuItem("Not done", null, "undo", null));
            return;
        }
        addItem(new WatchUi.MenuItem("Done", null, "done", null));
        if (offset == 0) {
            addItem(new WatchUi.MenuItem("Start now", "move it to now", "start", null));
        }
        addItem(new WatchUi.MenuItem("Snooze 15 min", hhmm(block["s"]) + " -> " + hhmm(block["s"] + 15), "snooze", null));
    }
}

class BlockActionsDelegate extends WatchUi.Menu2InputDelegate {
    var block;
    var parent;

    function initialize(b, p) {
        Menu2InputDelegate.initialize();
        block = b;
        parent = p;
    }

    function onSelect(item) {
        $.gStore.blockAction(item.getId(), block);
        parent.rebuild();
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}

// ---------- week ----------

class WeekMenu extends RefreshMenu {
    function initialize() {
        RefreshMenu.initialize("Week");
        rebuild();
    }

    function rebuild() {
        clear();
        var store = $.gStore;
        add("To schedule", store.list("backlog").size().toString() + " tasks this week", :backlog);
        for (var o = 0; o < 7; o++) {
            var blocks = store.blocksFor(store.dayInt(o));
            var total = 0;
            var done = 0;
            for (var i = 0; i < blocks.size(); i++) {
                total += blocks[i]["m"];
                if (blocks[i]["x"]) {
                    done += 1;
                }
            }
            var sub = (blocks.size() == 0) ? "free" : done.toString() + "/" + blocks.size() + " done · " + minsLabel(total);
            add(store.dayLabel(o), sub, o);
        }
    }
}

class WeekDelegate extends WatchUi.Menu2InputDelegate {
    var menu;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id == :backlog) {
            openBacklog();
        } else if (id instanceof Number) {
            openDay(id);
        }
    }
}

// ---------- tasks (week backlog and projects) ----------

class BacklogMenu extends RefreshMenu {
    var tasks = [];

    function initialize() {
        RefreshMenu.initialize("To schedule");
        rebuild();
    }

    function rebuild() {
        clear();
        tasks = $.gStore.list("backlog");
        for (var i = 0; i < tasks.size(); i++) {
            var t = tasks[i];
            add(t["t"], (t["b"] ? "blocked · " : "") + t["p"] + " · " + minsLabel(t["m"]), i);
        }
        if (tasks.size() == 0) {
            add("All scheduled", null, :none);
        }
    }

    function isBlocked(t) {
        return t["b"] == true;
    }
}

class ProjectsMenu extends RefreshMenu {
    var projects = [];

    function initialize() {
        RefreshMenu.initialize("Projects");
        rebuild();
    }

    function rebuild() {
        clear();
        projects = $.gStore.list("projects");
        for (var i = 0; i < projects.size(); i++) {
            var p = projects[i];
            var blocked = 0;
            var tasks = p["tasks"];
            for (var j = 0; j < tasks.size(); j++) {
                if (tasks[j]["b"].length() > 0) {
                    blocked += 1;
                }
            }
            add(p["n"], p["o"].toString() + " open" + (blocked > 0 ? " · " + blocked + " blocked" : ""), i);
        }
        if (projects.size() == 0) {
            add("No open projects", null, :none);
        }
    }
}

class ProjectsDelegate extends WatchUi.Menu2InputDelegate {
    var menu;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id instanceof Number) {
            var m = new ProjectTasksMenu(menu.projects[id], menu);
            push(m, new TaskListDelegate(m));
        }
    }
}

// Open tasks of one project: what is blocked, and by what.
class ProjectTasksMenu extends RefreshMenu {
    var project;
    var parent;
    var tasks = [];

    function initialize(p, parentMenu) {
        RefreshMenu.initialize(p["n"]);
        project = p;
        parent = parentMenu;
        rebuild();
    }

    function rebuild() {
        clear();
        tasks = project["tasks"];
        for (var i = 0; i < tasks.size(); i++) {
            var t = tasks[i];
            var sub;
            if (t["b"].length() > 0) {
                sub = "Waiting: " + t["b"];
            } else if (t["n"] > 0) {
                sub = "Blocks " + t["n"] + " · " + minsLabel(t["m"]);
            } else {
                sub = minsLabel(t["m"]);
            }
            add(t["t"], sub, i);
        }
        if (tasks.size() == 0) {
            add("No open tasks", null, :none);
        }
        if (parent != null) {
            parent.rebuild();
        }
    }

    function isBlocked(t) {
        return t["b"].length() > 0;
    }
}

class TaskListDelegate extends WatchUi.Menu2InputDelegate {
    var menu;

    function initialize(m) {
        Menu2InputDelegate.initialize();
        menu = m;
    }

    function onSelect(item) {
        var id = item.getId();
        if (id instanceof Number) {
            var task = menu.tasks[id];
            push(new TaskActionsMenu(task, menu.isBlocked(task)), new TaskActionsDelegate(task, menu));
        }
    }
}

class TaskActionsMenu extends WatchUi.Menu2 {
    function initialize(task, blocked) {
        Menu2.initialize({ :title => task["t"] });
        addItem(new WatchUi.MenuItem("Do today", blocked ? "still blocked" : "next free slot", "today", null));
        addItem(new WatchUi.MenuItem("Done", null, "done", null));
    }
}

class TaskActionsDelegate extends WatchUi.Menu2InputDelegate {
    var task;
    var parent;

    function initialize(t, p) {
        Menu2InputDelegate.initialize();
        task = t;
        parent = p;
    }

    function onSelect(item) {
        var a = item.getId();
        $.gStore.taskAction(a, task["k"]);
        toast(a.equals("today") ? "Sent to today's plan" : "Done: " + task["t"]);
        parent.rebuild();
        WatchUi.popView(WatchUi.SLIDE_RIGHT);
    }
}
