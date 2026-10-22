import Toybox.Application;
import Toybox.Background;
import Toybox.Communications;
import Toybox.Lang;
import Toybox.System;
import Toybox.Time;

// Runs while the app is closed: fetches the alert list, wakes the app (with a buzz) when a block
// starts, and schedules itself for the next block.
(:background)
class ReminderService extends System.ServiceDelegate {

    function initialize() {
        ServiceDelegate.initialize();
    }

    function onTemporalEvent() {
        var key = Sync.watchKey();
        if (key.length() == 0) {
            finish(Application.Storage.getValue("alerts"));
            return;
        }
        Communications.makeWebRequest(
            Sync.getUrl(key, ["alerts"]),
            null,
            {
                :method => Communications.HTTP_REQUEST_METHOD_GET,
                :responseType => Communications.HTTP_RESPONSE_CONTENT_TYPE_JSON
            },
            method(:onAlerts)
        );
    }

    function onAlerts(code, data) {
        var alerts = null;
        if (code == 200 && data instanceof Dictionary && data["fields"] != null) {
            alerts = Sync.decode(data["fields"]["alerts"]);
        }
        if (alerts == null) {
            // Phone not reachable: fall back to what the app saved last time.
            alerts = Application.Storage.getValue("alerts");
        }
        finish(alerts);
    }

    function finish(alerts) {
        var now = Time.now().value();
        var skip = Application.Storage.getValue("skip");
        var due = null;
        if (alerts != null) {
            for (var i = 0; i < alerts.size(); i++) {
                var a = Sync.parseAlert(alerts[i]);
                if (a != null && a[0] > now - 300 && a[0] <= now + 90 && !Sync.isSkipped(skip, a[1])) {
                    due = a[2];
                }
            }
        }
        Sync.scheduleNext(Sync.nextAlertAfter(alerts, now + 90, skip));
        if (due != null) {
            Background.requestApplicationWake("Start now:\n" + due);
        }
        Background.exit(null);
    }
}
