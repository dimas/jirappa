
WORKING_HOURS_PER_DAY = 8
WORKING_DAYS_PER_WEEK = 5

var units = [
    { code: 'w', seconds: 3600 * WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_WEEK },
    { code: 'd', seconds: 3600 * WORKING_HOURS_PER_DAY },
    { code: 'h', seconds: 3600 },
    { code: 'm', seconds: 60 },
    { code: 's', seconds: 1 }
];

function formatDurationInternal(seconds, highestUnit) {

    if (seconds == null || isNaN(seconds)) {
        return '';
    }

    var result = "";
    if (seconds < 0) {
        result = "-";
        seconds = -seconds;
    }

    var added = 0;

    for (var i = highestUnit; i < units.length; i++) {
        var unitSeconds = units[i].seconds
        var value = Math.floor(seconds / unitSeconds);
        if (value > 0 || (i == units.length - 1 && result == '')) {
            if (added > 0) {
                result += ' ';
            }
            result += value;
            result += units[i].code;
            added++;
        }
        seconds = seconds % unitSeconds;
    }
    return result;
}

function formatDuration(seconds) {
    return formatDurationInternal(seconds, 0);
}

function parseDuration(text) {

    if (text === undefined) {
        return false;
    }

    var result = null;

    var i = 0;
    while (true) {
        // Skip whitespace
        for ( ; i < text.length && text[i] == ' '; i++) ;

        if (i >= text.length) {
            break;
        }

        // Read number    
        var number = '';
        for ( ; i < text.length && text[i] >= '0' && text[i] <= '9'; number += text[i++]) ;

        if (i >= text.length) {
            // An invalid duration, unit is missing
            return null;
        }

        var value = parseInt(number, 10);
        if (value == NaN) {
            // An invalid duration, somehow the digi-only string is an invalid number... may be too long?
            return null;
        }

        // Read unit
        var unitCode = text[i++];
        var unit = null;
        for (var j = 0; unit == null && j < units.length; j++) {
            if (units[j].code == unitCode) {
                unit = units[j];
            }
        }

        if (unit == null) {
            // An invalid duration, invalid unit
            return null;
        }

        result += unit.seconds * value;
    }

    return result;
}

function parseDurationDays(text) {
    if (/^\d+$/.test(text)) {
        // Just a number. Assume it is number of days
        var value = parseInt(text, 10);
        return isNaN(value) ? null : value * 3600 * WORKING_HOURS_PER_DAY;
    } else {
        // Otherwise it must be duration in its full form
        return parseDuration(text);
    }
}

function formatDurationDays(seconds) {
    return formatDurationInternal(seconds, 1);
}

