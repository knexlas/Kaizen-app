import Toybox.Application;
import Toybox.Attention;
import Toybox.Lang;
import Toybox.Timer;
import Toybox.WatchUi;

(:background)
class KaizenApp extends Application.AppBase {
    var ticker = null;

    function initialize() {
        AppBase.initialize();
    }

    function getServiceDelegate() {
        return [new ReminderService()];
    }

    function getInitialView() {
        $.gStore = new Store();
        $.gStore.fetch();
        $.gStore.scheduleReminders();
        ticker = new Ticker();
        return [new NowView(), new NowDelegate()];
    }

    function onSettingsChanged() {
        if ($.gStore != null) {
            $.gStore.fetch();
        }
    }

    function onStop(state) {
        // Also called when the background process ends; only the foreground has a store.
        if (ticker != null) {
            ticker.stop();
            $.gStore.scheduleReminders();
        }
    }
}

// While the app is open: buzz at block start and end, refresh the feed every 5 minutes.
class Ticker {
    var timer;
    var lastMinute = -1;
    var ticks = 0;

    function initialize() {
        timer = new Timer.Timer();
        timer.start(method(:tick), 10000, true);
    }

    function stop() {
        timer.stop();
    }

    function tick() as Void {
        var store = $.gStore;
        var now = store.nowMin();
        ticks += 1;
        if (ticks % 30 == 0) {
            store.fetch();
        }
        if (now == lastMinute) {
            return;
        }
        lastMinute = now;
        var blocks = store.blocksFor(store.dayInt(0));
        for (var i = 0; i < blocks.size(); i++) {
            var b = blocks[i];
            if (b["x"]) {
                continue;
            }
            if (b["s"] == now) {
                buzz(true);
                toast("Start: " + b["t"]);
            } else if (b["s"] + b["m"] == now) {
                buzz(false);
                toast("Time's up: " + b["t"]);
            }
        }
        WatchUi.requestUpdate();
    }
}

function buzz(strong) {
    if (Attention has :vibrate) {
        var pattern = strong
            ? [new Attention.VibeProfile(100, 500), new Attention.VibeProfile(0, 200), new Attention.VibeProfile(100, 500)]
            : [new Attention.VibeProfile(60, 300)];
        Attention.vibrate(pattern);
    }
    if (strong && Attention has :playTone) {
        Attention.playTone(Attention.TONE_ALERT_HI);
    }
}

function toast(text) {
    if (WatchUi has :showToast) {
        WatchUi.showToast(text, null);
    }
}
