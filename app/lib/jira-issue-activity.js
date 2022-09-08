
function findChangeFor(items, field) {
    for (i = 0; i < items.length; i++) {
        if (items[i].field == field) {
            return items[i];
        }
    }
    return null;
}

var STATE_TRANSITIONS = [
    { fromStatus: "InAnalysis", toStatus: "InReview",   actorRole: "developer", assigneeRole: "reviewer"  },
    { fromStatus: "InProgress", toStatus: "InReview",   actorRole: "developer", assigneeRole: "reviewer"  },
    { fromStatus: "Open",       toStatus: "InProgress", actorRole: null,        assigneeRole: "developer" },
    { fromStatus: "Reopened",   toStatus: "InProgress", actorRole: null,        assigneeRole: "developer" },
    { fromStatus: "InReview",   toStatus: "InProgress", actorRole: "reviewer",  assigneeRole: "developer" },
    { fromStatus: "InReview",   toStatus: "InTest",     actorRole: "reviewer",  assigneeRole: "developer" },
    { fromStatus: "InTest",     toStatus: "Closed",     actorRole: "developer", assigneeRole: null        },
    { fromStatus: "InTest",     toStatus: "Reopened",   actorRole: null,        assigneeRole: "developer" },
    { fromStatus: "InProgress", toStatus: "InTest",     actorRole: "reviewer",  assigneeRole: "developer" },
]

function findTransition(fromStatus, toStatus) {
    for (i = 0; i < STATE_TRANSITIONS.length; i++) {
        if (STATE_TRANSITIONS[i].fromStatus == fromStatus && STATE_TRANSITIONS[i].toStatus == toStatus) {
            return STATE_TRANSITIONS[i];
        }
    }
    return null;
}

function rolesFromStateTransitions(author, fromStatus, toStatus, assignee) {
    var roles = [];

    var transition = findTransition(fromStatus, toStatus);
    if (transition == null) {
        return roles;
    }

    if (transition.actorRole) {
        roles.push({personKey: author.key, role: transition.actorRole});
    }

    if (transition.assigneeRole && assignee) {
        roles.push({personKey: assignee, role: transition.assigneeRole});
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

// Analyse activity in the ticket, figure out roles of the people participated and produce a work report.
// Returns an object containing
//   * issue - the JIRA issue itself
//   * timeline - ordered list of status changes and worklog items submitted
//   * work - total amount of work for each activity logged by each person.
// Note that if startTime/endTime is passed, they will only affect the "work" reported by only inclusing
// the work items within these bounds. Timeline will still be reported in full.
function analyzeActivity(issue, startTime, endTime) {

    var timeline = [];

    var roles = [];
    var assignee = null;
    for (j = 0; j < issue.changelog.histories.length; j++) {
        var logEntry = issue.changelog.histories[j];

        var assigneeChange = findChangeFor(logEntry.items, "assignee");
        if (assigneeChange != null) {
            assignee = assigneeChange.to;
        }

        var statusChange = findChangeFor(logEntry.items, "status");
        if (statusChange != null) {
            var fromStatus = issueStatusCode(statusChange.fromString);
            var toStatus = issueStatusCode(statusChange.toString);
            timeline.push({
                timestamp: new Date(logEntry.created),
                author: logEntry.author.key,
                statusChange: {
                    assignee: assignee,
                    from: fromStatus,
                    to: toStatus,
                }
            });

            add(roles, rolesFromStateTransitions(logEntry.author, fromStatus, toStatus, assignee));
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

            // Do not include work outside of the selected window
            if ((startTime && startTime > entry.timestamp) || (endTime && endTime < entry.timestamp)) {
                return;
            }

            var personData = personWork[entry.author];
            if (!personData) {
                personData = personWork[entry.author] = {};
            }

            var role = null;

            if (currentStatus == "InTest" || currentStatus == "Closed") {
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

