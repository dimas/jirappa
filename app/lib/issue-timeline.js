
function findChangeFor(items, field) {
    for (i = 0; i < items.length; i++) {
        if (items[i].field == field) {
            return items[i];
        }
    }
    return null;
}

var STATE_TRANSITIONS = [
    { fromStatus: "In Progress", toStatus: "In Review",   actorRole: "developer", assigneeRole: "reviewer" },
    { fromStatus: "Open",        toStatus: "In Progress", actorRole: "developer", assigneeRole: "developer" },
    { fromStatus: "In Test",     toStatus: "Closed",      actorRole: "developer" },
    { fromStatus: "In Review",   toStatus: "In Progress", actorRole: "reviewer",  assigneeRole: "developer" },
    { fromStatus: "In Review",   toStatus: "In Test",     actorRole: "reviewer",  assigneeRole: "developer" },
    { fromStatus: "In Progress", toStatus: "In Test",     actorRole: "reviewer" },
]

function findTransition(fromStatus, toStatus) {
    for (i = 0; i < STATE_TRANSITIONS.length; i++) {
        if (STATE_TRANSITIONS[i].fromStatus == fromStatus && STATE_TRANSITIONS[i].toStatus == toStatus) {
            return STATE_TRANSITIONS[i];
        }
    }
    return null;
}

function rolesFromStateTransitions(logEntry) {
    var statusChange = findChangeFor(logEntry.items, "status");
    if (statusChange == null) {
        return [];
    }
console.log("" + logEntry.author.key + " " + statusChange.fromString + " => " + statusChange.toString);

    var transition = findTransition(statusChange.fromString, statusChange.toString);
    if (transition == null) {
        return [];
    }

    var roles = [];

    if (transition.actorRole != null) {
        roles.push({personKey: logEntry.author.key, role: transition.actorRole});
    }

    if (transition.assigneeRole != null) {
        var assigneeChange = findChangeFor(logEntry.items, "assignee");
        if (assigneeChange != null && assigneeChange.to != null) {
            roles.push({personKey: assigneeChange.to, role: transition.assigneeRole});
        }
    }

    return roles;
}

function workPerPerson(worklogs) {
    var result = {};

    worklogs.forEach(function(worklog) {

        var personKey = worklog.author.key;
        if (!(personKey in result)) {
            result[personKey] = 0;
        }
        result[personKey] += worklog.timeSpentSeconds;

//console.log("" + personKey + " : " + worklog.timeSpentSeconds);

    });

    return result;
}

function processIssues(issues) {

    var timeline = [];

    var data = {};

    issuesData = [];

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

//        var roles = [];
        for (j = 0; j < issue.changelog.histories.length; j++) {
            var logEntry = issue.changelog.histories[j];
//            add(roles, rolesFromStateTransitions(logEntry));

            var statusChange = findChangeFor(logEntry.items, "status");
            if (statusChange != null) {
                var assigneeChange = findChangeFor(logEntry.items, "assignee");
                timeline.push({
                    timestamp: new Date(logEntry.created),
                    author: logEntry.author.key,
                    statusChange: {
                        assignee: (assigneeChange != null) ? assigneeChange.to : null,
                        from: statusChange.fromString,
                        to: statusChange.toString,
                    }
                });
            }
        }
    }

//        var people = workPerPerson(issue.fields.worklog.worklogs);

    issue.fields.worklog.worklogs.forEach(function(worklog) {
            timeline.push({
                timestamp: new Date(worklog.started),
                author: worklog.author.key,
                worklog: {
                    timeSpent: worklog.timeSpentSeconds
                }
            });
    });

    timeline.sort(function(a, b) { return compare(a.timestamp, b.timestamp); });

    timelineTable.bootstrapTable('load', timeline);
}

function formatTimestamp(value) {
   // I cannot believe there are no normal date formatting methods and I need to either use additional libraries
   // or do it manually...
   //   https://stackoverflow.com/questions/3552461/how-to-format-a-javascript-date
   // Neither there is string formatting or padding. My god, what a language.
   return ''
       + value.getFullYear().toString().padStart(4, '0')
       + '-'
       + (value.getMonth() + 1).toString().padStart(2, '0')
       + '-'
       + value.getDate().toString().padStart(2, '0')
       + ' '
       + value.getHours().toString().padStart(2, '0')
       + ':'
       + value.getMinutes().toString().padStart(2, '0')
       + ':'
       + value.getSeconds().toString().padStart(2, '0');
}


// https://docs.atlassian.com/jira/REST/latest/


async function loadIssue() {

    var issue = $('#issue').val();
    if (!issue) {
        return;
    }

    timelineTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
//        jql: "assignee in membersOf('" + GROUP + "')",
        jql: "key = '" + issue + "'",
        fields: "summary,assignee,status,priority,updated,worklog",
        expand: "changelog",
    });

    processIssues(issues);

    timelineTable.bootstrapTable('hideLoading');
}

var timelineTable;

function initTimelineTable() {
    timelineTable = $('#timeline');
    timelineTable.bootstrapTable({
    });
}

// Init tables and load data
$(function () {
    initTimelineTable();

    loadIssue();
});

