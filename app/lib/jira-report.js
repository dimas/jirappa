
PRIORITY_ORDER = [
    "Un-Prioritized",
    "Trivial",
    "Minor",
    "Major",
    "Critical",
    "Blocker",
]

function getPriorityOrder(priorityName) {
    return PRIORITY_ORDER.indexOf(priorityName);
}

function formatIssuePriority(priority) {
    if (priority == null) {
        return '';
    }

    return '<img style="width: 16px; height: 16px" src="' + priority.iconUrl + '" title="' +  escapeText(priority.name) + '"/>';
}

function issuePrioritySorter(a, b) {
    return compare(getPriorityOrder(a.name), getPriorityOrder(b.name));
}

function formatIssueKey(issue) {
    return '<a target="_blank" href="' + JIRA_URL + '/browse/' + escapeText(issue) + '">' + escapeText(issue) + '</a>';
}

function formatProgress(progress) {
    var result = '';

    if (progress.estimated == null || progress.estimated == null || progress.left == null) {
        return result;
    }

    var percent = Math.round(100 * progress.spent / progress.estimated);

    var text = 'Estimated: ' + formatDuration(progress.estimated) + '\n' +
               'Spent: ' + formatDuration(progress.spent) + ' (' + percent + '%)\n' +
               'Left: ' + formatDuration(progress.left);
/*
    if (progress.spent <= progress.estimated) {
        remainingColour = (remain > 3600 * WORKING_HOURS_PER_DAY) ? '#D0D0D0' : '#D0D080';
        remainingColour = '#E0E0E0';
        result = '<div title="' + text + '" style="height: 24px; width: 200px; background-color: ' + remainingColour + '"><div style="height: 24px; width: ' + percent + '%; background-color: #6060FF;"></div></div>'
    } else {
        result = '<div title="' + text + '" style="height: 24px; width: 200px; background-color: #FF4040"><div style="height: 24px; width: ' + Math.round(100*100/percent) + '%; background-color: #FFC0C0;"></div></div>'
    }
*/
/*
    if (progress.spent <= progress.estimated) {
        result += '<div title="' + text + '" style="height: 8px; width: 200px; "><div style="height: 8px; width: 100%; background-color: #E0E0E0;"></div></div>'
        result += '<div title="' + text + '" style="height: 8px; width: 200px; "><div style="height: 8px; width: ' + percent + '%; background-color: #8080FF;"></div></div>'
    } else {

        result += '<div title="' + text + '" style="height: 8px; width: 200px; "><div style="height: 8px; width: ' + Math.round(100*100/percent) + '%; background-color: #E0E0E0;"></div></div>'
        result += '<div title="' + text + '" style="height: 8px; width: 200px; "><div style="height: 8px; width: 100%; background-color: #FF8080;"></div></div>'
    }
*/

    if (progress.spent <= progress.estimated) {
        result += '<div title="' + escapeText(text) + '" style="height: 8px; width: 200px; background-color: #E0E0E0; "><div style="height: 8px; width: ' + percent + '%; background-color: #8080FF;"></div></div>'
    } else {

        result += '<div title="' + escapeText(text) + '" style="height: 8px; width: 200px; background-color: #FF6060; "><div style="height: 8px; width: ' + Math.round(100*100/percent) + '%; background-color: #8080FF;"></div></div>'
    }

    return result;
}

function formatIssueSummary(issue) {
    return '<a target="_blank" href="' + JIRA_URL + '/browse/' + escapeText(issue.key) + '">' + escapeText(issue.key) + '</a> ' + escapeText(issue.fields.summary);
}

function formatDate(value) {
    return isoDate(value);
}

function formatTimestamp(value) {
    return isoDate(value) + ' ' + isoTime(value);
}

function issueCellStyle(value, row, index) {
    if (row.parentIssue) {
        return {
              css: {"vertical-align" : "top", "padding-left": "40px", "color": "grey"}
        };
    }
    return { css: {"vertical-align" : "top"} };
}

function timeRemainCellStyle(value, row, index) {
    if (value < 0) {
        return {
              css: {"vertical-align" : "top", "background": "#FFC0C0"}
        };
    } else if (value > 0 && value <= WORKING_HOURS_PER_DAY * 3600) {
        return {
              css: {"vertical-align" : "top", "background": "#FFFFC0"}
        };
    } else {
        return { css: {"vertical-align" : "top"} };
    }
}

function issueKeySorter(a, b) {
    return compareJiraKey(a, b);
}

function compareJiraKey(a, b) {
    var re = /^([a-z0-9]+)-(\d+)$/i;
    var am = re.exec(a);
    var bm = re.exec(b);
    if (am && bm) {
        // Both are valid ticket numbers
        var res = compare(am[1], bm[1]);
        if (res != 0) {
            return res;
        }
        return compare(parseInt(am[2], 10), parseInt(bm[2], 10));
    }
    return compare(a, b);
}

function comparePersonDisplayName(a, b) {
    return compare(a.displayName, b.displayName);
}


var progressStatusOrder = [
        "In Progress",
        "Open",
        "In Review",
        "In Analysis",
        "New",
        "Blocked",
        "In Test",
        "Closed",
];

function compareStatus(a, b) {
    return progressStatusOrder.indexOf(b) - progressStatusOrder.indexOf(a);
}

function uniquePeople(list) {
    var result = []
    for (var i = 0; i < list.length; i++) {
        var j;
        var found = false;
        for (j = 0; j < result.length; j++) {
            if (result[j].key == list[i].key) {
                found = true;
                break;
            }
        }
        if (!found) {
            result.push(list[i]);
        }
    }

    return result;
}


