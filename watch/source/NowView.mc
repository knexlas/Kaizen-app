import Toybox.Graphics;
import Toybox.Lang;
import Toybox.WatchUi;

const ACCENT = 0x6FCF6F;
const MUTED = 0x9A9A9A;
const DIM = 0x333333;
const WARN = 0xF0B44C;
const SUBTLE = 0x666666;

function hhmm(mins) {
    return (mins / 60).format("%02d") + ":" + (mins % 60).format("%02d");
}

function minsLabel(mins) {
    if (mins < 60) {
        return mins.toString() + "m";
    }
    return (mins % 60 == 0) ? (mins / 60).toString() + "h" : (mins / 60).toString() + "h" + (mins % 60).format("%02d");
}

// Main screen: what to do now, what's next, today's progress.
class NowView extends WatchUi.View {

    function initialize() {
        View.initialize();
    }

    function onUpdate(dc) {
        var store = $.gStore;
        var w = dc.getWidth();
        var h = dc.getHeight();
        var cx = w / 2;
        var now = store.nowMin();
        var cur = store.current();
        var next = store.upcoming();
        var stats = store.dayStats(store.dayInt(0));

        dc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_BLACK);
        dc.clear();

        dc.setColor(MUTED, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.10, Graphics.FONT_XTINY, hhmm(now), Graphics.TEXT_JUSTIFY_CENTER);

        if (cur != null) {
            var frac = (now - cur["s"]).toFloat() / cur["m"];
            drawRing(dc, w, h, frac);
            dc.setColor(ACCENT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.22, Graphics.FONT_XTINY, "NOW · until " + hhmm(cur["s"] + cur["m"]), Graphics.TEXT_JUSTIFY_CENTER);
            drawTitle(dc, cx, h * 0.31, w * 0.80, cur["t"]);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.50, Graphics.FONT_SMALL, minsLabel(cur["s"] + cur["m"] - now) + " left", Graphics.TEXT_JUSTIFY_CENTER);
        } else if (next != null) {
            dc.setColor(MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.22, Graphics.FONT_XTINY, "FREE · next in " + minsLabel(next["s"] - now), Graphics.TEXT_JUSTIFY_CENTER);
            drawTitle(dc, cx, h * 0.31, w * 0.80, next["t"]);
            dc.setColor(ACCENT, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.50, Graphics.FONT_SMALL, "at " + hhmm(next["s"]), Graphics.TEXT_JUSTIFY_CENTER);
        } else {
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            var msg = (store.data == null) ? "Kaizen" : (stats[1] > 0 ? "All done" : "Nothing planned");
            dc.drawText(cx, h * 0.33, Graphics.FONT_MEDIUM, msg, Graphics.TEXT_JUSTIFY_CENTER);
        }

        if (cur != null && next != null) {
            dc.setColor(MUTED, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.64, Graphics.FONT_XTINY, "NEXT " + hhmm(next["s"]), Graphics.TEXT_JUSTIFY_CENTER);
            dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
            dc.drawText(cx, h * 0.70, Graphics.FONT_TINY, fit(dc, next["t"], Graphics.FONT_TINY, w * 0.72), Graphics.TEXT_JUSTIFY_CENTER);
        }

        dc.setColor(stats[1] > 0 && stats[0] == stats[1] ? ACCENT : Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.80, Graphics.FONT_XTINY, stats[0].toString() + "/" + stats[1] + " done today", Graphics.TEXT_JUSTIFY_CENTER);
        dc.setColor(store.status.length() > 0 ? WARN : SUBTLE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(cx, h * 0.87, Graphics.FONT_XTINY, store.syncLabel(), Graphics.TEXT_JUSTIFY_CENTER);
    }

    // Progress around the bezel, clockwise from 12 o'clock.
    function drawRing(dc, w, h, frac) {
        var r = (w < h ? w : h) / 2 - 6;
        dc.setPenWidth(8);
        dc.setColor(DIM, Graphics.COLOR_TRANSPARENT);
        dc.drawCircle(w / 2, h / 2, r);
        if (frac <= 0) {
            return;
        }
        dc.setColor(ACCENT, Graphics.COLOR_TRANSPARENT);
        if (frac >= 1) {
            dc.drawCircle(w / 2, h / 2, r);
        } else {
            dc.drawArc(w / 2, h / 2, r, Graphics.ARC_CLOCKWISE, 90, 90 - 360 * frac);
        }
        dc.setPenWidth(1);
    }

    // Title in the largest font that fits, up to two lines.
    function drawTitle(dc, cx, y, maxW, text) {
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        if (dc.getTextWidthInPixels(text, Graphics.FONT_MEDIUM) <= maxW) {
            dc.drawText(cx, y, Graphics.FONT_MEDIUM, text, Graphics.TEXT_JUSTIFY_CENTER);
            return;
        }
        var lines = wrap(dc, text, Graphics.FONT_SMALL, maxW);
        dc.drawText(cx, y, Graphics.FONT_SMALL, lines, Graphics.TEXT_JUSTIFY_CENTER);
    }
}

// Two-line word wrap; the second line is truncated.
function wrap(dc, text, font, maxW) {
    var words = [];
    var rest = text;
    var space = rest.find(" ");
    while (space != null) {
        words.add(rest.substring(0, space));
        rest = rest.substring(space + 1, rest.length());
        space = rest.find(" ");
    }
    words.add(rest);
    var first = "";
    var i = 0;
    while (i < words.size()) {
        var candidate = (first.length() == 0) ? words[i] : first + " " + words[i];
        if (dc.getTextWidthInPixels(candidate, font) > maxW && first.length() > 0) {
            break;
        }
        first = candidate;
        i += 1;
    }
    if (i >= words.size()) {
        return fit(dc, first, font, maxW);
    }
    var second = "";
    for (var j = i; j < words.size(); j++) {
        second = (second.length() == 0) ? words[j] : second + " " + words[j];
    }
    return fit(dc, first, font, maxW) + "\n" + fit(dc, second, font, maxW);
}

function fit(dc, text, font, maxW) {
    if (dc.getTextWidthInPixels(text, font) <= maxW) {
        return text;
    }
    var s = text;
    while (s.length() > 1 && dc.getTextWidthInPixels(s + "..", font) > maxW) {
        s = s.substring(0, s.length() - 1);
    }
    return s + "..";
}

class NowDelegate extends WatchUi.BehaviorDelegate {

    function initialize() {
        BehaviorDelegate.initialize();
    }

    function onSelect() {
        openMainMenu();
        return true;
    }

    function onMenu() {
        openMainMenu();
        return true;
    }

    function onNextPage() {
        openDay(0);
        return true;
    }

    function onPreviousPage() {
        openWeek();
        return true;
    }
}
