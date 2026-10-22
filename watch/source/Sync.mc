import Toybox.Application;
import Toybox.Background;
import Toybox.Lang;
import Toybox.Time;

// Shared by the app and the background reminder: Firestore URLs, value decoding, alert parsing, scheduling.
(:background)
module Sync {
    const BASE = "https://firestore.googleapis.com/v1/projects/";

    function watchKey() {
        var key = Application.Properties.getValue("watchKey");
        return (key == null) ? "" : key.toString().toLower();
    }

    function feedUrl(key) {
        return BASE + Config.PROJECT_ID + "/databases/(default)/documents/watchFeeds/" + key;
    }

    // Read the feed; `fields` limits the response (the background reminder asks for "alerts" only).
    function getUrl(key, fields) {
        var url = feedUrl(key) + "?key=" + Config.API_KEY;
        for (var i = 0; i < fields.size(); i++) {
            url += "&mask.fieldPaths=" + fields[i];
        }
        return url;
    }

    function eventsUrl(key) {
        return feedUrl(key) + "/events?key=" + Config.API_KEY;
    }

    // Firestore REST value -> plain Monkey C value.
    function decode(v) {
        if (v == null) {
            return null;
        }
        if (v.hasKey("stringValue")) {
            return v["stringValue"];
        }
        if (v.hasKey("integerValue")) {
            var s = v["integerValue"].toString();
            return (s.length() > 9) ? s.toLong() : s.toNumber();
        }
        if (v.hasKey("booleanValue")) {
            return v["booleanValue"];
        }
        if (v.hasKey("doubleValue")) {
            return v["doubleValue"];
        }
        if (v.hasKey("arrayValue")) {
            var out = [];
            var values = v["arrayValue"]["values"];
            if (values != null) {
                for (var i = 0; i < values.size(); i++) {
                    out.add(decode(values[i]));
                }
            }
            return out;
        }
        if (v.hasKey("mapValue")) {
            return decodeFields(v["mapValue"]["fields"]);
        }
        return null;
    }

    function decodeFields(fields) {
        var out = {};
        if (fields == null) {
            return out;
        }
        var keys = fields.keys();
        for (var i = 0; i < keys.size(); i++) {
            out[keys[i]] = decode(fields[keys[i]]);
        }
        return out;
    }

    // "epoch|blockId|startMinute|title" -> [epoch, "blockId|startMinute", title]
    function parseAlert(text) {
        if (text == null) {
            return null;
        }
        var s = text.toString();
        var p1 = s.find("|");
        if (p1 == null) {
            return null;
        }
        var rest = s.substring(p1 + 1, s.length());
        var p2 = rest.find("|");
        if (p2 == null) {
            return null;
        }
        var afterId = rest.substring(p2 + 1, rest.length());
        var p3 = afterId.find("|");
        if (p3 == null) {
            return null;
        }
        return [
            s.substring(0, p1).toNumber(),
            rest.substring(0, p2) + "|" + afterId.substring(0, p3),
            afterId.substring(p3 + 1, afterId.length())
        ];
    }

    // Next background wake: the next alert, but at least every 30 minutes so web changes reach the watch.
    function scheduleNext(nextEpoch) {
        if (!(Toybox has :Background)) {
            return;
        }
        var now = Time.now().value();
        var at = now + 1800;
        if (nextEpoch != null && nextEpoch < at) {
            at = nextEpoch;
        }
        var last = Background.getLastTemporalEventTime();
        var earliest = (last == null) ? now + 60 : last.value() + 300;
        if (at < earliest) {
            at = earliest;
        }
        Background.registerForTemporalEvent(new Time.Moment(at));
    }

    // Earliest alert strictly after `after` (epoch seconds), skipping blocks handled on the watch.
    function nextAlertAfter(alerts, after, skip) {
        var best = null;
        if (alerts == null) {
            return null;
        }
        for (var i = 0; i < alerts.size(); i++) {
            var a = parseAlert(alerts[i]);
            if (a == null || a[0] <= after || isSkipped(skip, a[1])) {
                continue;
            }
            if (best == null || a[0] < best) {
                best = a[0];
            }
        }
        return best;
    }

    function isSkipped(skip, blockKey) {
        if (skip == null) {
            return false;
        }
        for (var i = 0; i < skip.size(); i++) {
            if (skip[i].equals(blockKey)) {
                return true;
            }
        }
        return false;
    }
}
