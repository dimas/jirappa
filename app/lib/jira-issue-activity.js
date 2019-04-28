
function findChangeFor(items, field) {
    for (i = 0; i < items.length; i++) {
        if (items[i].field == field) {
            return items[i];
        }
    }
    return null;
}

var STATE_TRANSITIONS = [
    { fromStatus: "In Progress", toStatus: "In Review",   actorRole: "developer", assigneeRole: "reviewer"  },
    { fromStatus: "Open",        toStatus: "In Progress", actorRole: "developer", assigneeRole: "developer" },
    { fromStatus: "Reopened",    toStatus: "In Progress", actorRole: "developer", assigneeRole: "developer" },
    { fromStatus: "In Review",   toStatus: "In Progress", actorRole: "reviewer",  assigneeRole: "developer" },
    { fromStatus: "In Review",   toStatus: "In Test",     actorRole: "reviewer",  assigneeRole: "developer" },
    { fromStatus: "In Test",     toStatus: "Closed",      actorRole: "developer", assigneeRole: null        },
    { fromStatus: "In Test",     toStatus: "Reopened",    actorRole: null,        assigneeRole: "developer" },
    { fromStatus: "In Progress", toStatus: "In Test",     actorRole: "reviewer",  assigneeRole: "developer" },
]

function findTransition(fromStatus, toStatus) {
    for (i = 0; i < STATE_TRANSITIONS.length; i++) {
        if (STATE_TRANSITIONS[i].fromStatus == fromStatus && STATE_TRANSITIONS[i].toStatus == toStatus) {
            return STATE_TRANSITIONS[i];
        }
    }
    return null;
}

function rolesFromStateTransitions(author, statusChange, assigneeChange) {
    var roles = [];

    if (statusChange == null) {
        return roles;
    }

    var transition = findTransition(statusChange.fromString, statusChange.toString);
    if (transition == null) {
        return roles;
    }

    if (transition.actorRole) {
        roles.push({personKey: author.key, role: transition.actorRole});
    }

    if (transition.assigneeRole && assigneeChange && assigneeChange.to) {
        roles.push({personKey: assigneeChange.to, role: transition.assigneeRole});
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

// Finds the most frequent item in the array
function mostFrequent(items) {

    var bestValue = null;
    var bestCount = 0;

    var counts = {};
    items.forEach(function(value) {
        var count = counts[value] || 0;
        count++;
        counts[value] = count;
        if (count > bestCount) {
            bestValue = value;
            bestCount = count;
        }
    });

    return bestValue;
}

function analyzeActivity(issue) {

    var timeline = [];

    var roles = [];
    for (j = 0; j < issue.changelog.histories.length; j++) {
        var logEntry = issue.changelog.histories[j];

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

            add(roles, rolesFromStateTransitions(logEntry.author, statusChange, assigneeChange));
        }
    }

    var personRoles = {};
    roles.forEach(function(role) {
        personRoles[role.personKey] = personRoles[role.personKey] || [];
        personRoles[role.personKey].push(role.role);
    });

    var primaryRoles = {};
    Object.keys(personRoles).forEach(function(personKey) {
        primaryRoles[personKey] = mostFrequent(personRoles[personKey]);
    });

    var personTime = {};
    issue.fields.worklog.worklogs.forEach(function(worklog) {
            timeline.push({
                timestamp: new Date(worklog.started),
                author: worklog.author.key,
                worklog: {
                    timeSpent: worklog.timeSpentSeconds,
                    comment: worklog.comment
                }
            });

            var personKey = worklog.author.key;
            personTime[personKey] = (personTime[personKey] || 0) + worklog.timeSpentSeconds;
    });

    timeline.sort(function(a, b) { return compare(a.timestamp, b.timestamp); });



    // Classify work done by all participants
    // Below will be a series of guesses of what a particular team member was doing at a particular time.

    var personWork = {};

    var lastStatus = null;
    var currentStatus = null;
    timeline.forEach(function(entry) {
        if (entry.statusChange) {
            lastStatus = currentStatus;
            currentStatus = entry.statusChange.to;
        } else if (entry.worklog) {

            var personData = personWork[entry.author];
            if (!personData) {
                personData = personWork[entry.author] = {};
            }

            var role = null;

            if (currentStatus == "In Test" || currentStatus == "Closed") {
                // Chances are that anything logged during test state was testing.
                // "Closed" tries to account for the fact one can close the ticket first and then log the testing time.
                role = "tester";
            }

            if (role == null) {
                role = primaryRoles[entry.author];
            }

            if (role == null) {
                // If worklog comment says "review", it could be a review.
                // Not guaranteed of course because it could be "working on code review comments"
                var regex = /review/i;
                if (regex.test(entry.worklog.comment)) {
                    role = "reviewer";
                }
            }

            if (role == "reviewer" && entry.worklog.timeSpent >= 3 * 60 * 60) {
                // A code review of 3 hours or more in one worklog entry seems really unlikely
                role = "developer";
            }

            var activityData = personData[role];
            if (!activityData) {
                activityData = personData[role] = 0;
            }

            activityData += entry.worklog.timeSpent;

            personData[role] = activityData;
        }
    });


    var work = [];
    Object.keys(personWork).forEach(function(personKey) {
        var personData = personWork[personKey];
        Object.keys(personData).forEach(function(activity) {
            work.push({
                person: personKey,
                activity: activity,
                timeSpent: personData[activity],
            });
        });
    });

    return {
        issue: issue,
        timeline: timeline,
        work: work,
    };
}

