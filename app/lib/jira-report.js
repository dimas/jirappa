
var worklog_data = [];

function formatIssueKey(issue) {
    return '<a href="' + JIRA_URL + '/browse/' + issue + '">' + issue + '</a>';
}

function formatContributors(contributors) {
    var result = '';
    for (var i = 0; i < contributors.length; i++) {
         result += '<img style="width: 24px; height: 24px" src="' + contributors[i]['avatarUrls']['48x48'] + '" title="' +  contributors[i].displayName + '"/>';
    }
    return result;
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
        result += '<div title="' + text + '" style="height: 8px; width: 200px; background-color: #E0E0E0; "><div style="height: 8px; width: ' + percent + '%; background-color: #8080FF;"></div></div>'
    } else {

        result += '<div title="' + text + '" style="height: 8px; width: 200px; background-color: #FF6060; "><div style="height: 8px; width: ' + Math.round(100*100/percent) + '%; background-color: #8080FF;"></div></div>'
    }

    return result;
}

function formatIssueSummary(issue) {
    return '<a href="' + JIRA_URL + '/browse/' + issue.key + '">' + issue.key + '</a> '  + issue.fields.summary;
}

function rowStyle(row, index) {
    if (row.parentIssue) {
        return {
              css: {"color": "grey"}
        };
    }
    return { css: {"vertical-align" : "top"} };
}

function cellStyle(value, row, index) {
console.log("CS: value=" + value + ", row="+ row + ", index=" + index);
    var classes = ['active', 'success', 'info', 'warning', 'danger'];
    
    if (index % 2 === 0 && index / 2 < classes.length) {
        return {
            classes: classes[index / 2]
        };
    }
    return {};
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

var worklogIssuesData;
var progressIssuesData;

function renderWorklogTable(issues) {

    var dates = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];
        var worklogs = issue.fields.worklog.worklogs;
        for (j = 0; j < worklogs.length; j++) {
            var worklog = worklogs[j];

            // Date is in "2017-06-02T09:00:00.000+0100" format
            var date = worklog.started.substring(0, 10);

            var person = worklog.author.displayName;

            var dateData = dates[date];
            if (dateData === undefined) {
                dates[date] = dateData = {
                    date: date,
                    people: {}
                };
            }

            var personData = dateData.people[person];
            if (personData === undefined) {
                dateData.people[person] = personData = {
                    name: person,
                    timeLogged: 0,
                    tasks: {}
                };
            }

            var taskIssue = issue;
            if (issue.fields.parent) {
                taskIssue = issue.fields.parent;
            }

            var taskData = personData.tasks[taskIssue.key];
            if (!taskData) {
                personData.tasks[taskIssue.key] = taskData = {
                    key: taskIssue.key, 
                    summary: taskIssue.fields.summary,
                    status: taskIssue.fields.status.name,
                    timeLogged: 0,
                    subtasks: {}
                };
            }

            if (taskIssue != issue) {
                var subtaskData = taskData.subtasks[issue.key];
                if (!subtaskData) {
                    taskData.subtasks[issue.key] = subtaskData = {
                        key: issue.key, 
                        summary: issue.fields.summary,
                        status: issue.fields.status.name,
                        timeLogged: 0
                    };
                }
                subtaskData.timeLogged += worklog.timeSpentSeconds;
            }

            taskData.timeLogged += worklog.timeSpentSeconds;
            personData.timeLogged += worklog.timeSpentSeconds;
        }
    }

    var tableItems = [];
    var merges = [];

    dates = values(dates).sort(function(a, b) { return compare(b.date, a.date); });
    for (var d in dates) {
        var dayData = dates[d];
        var date = dayData.date;
        var dateRow = tableItems.length;

        var people = values(dayData.people).sort(function(a, b) { return compare(a.name, b.name); });
        for (var p in people) {
            var personData = people[p];
            var personRow = tableItems.length;

            tableItems.push({
                date: date,
                person: personData.name,
                timeSpent: personData.timeLogged
            });

            merges.push({index: personRow, field: 'person', rowspan: 1, colspan: 4});

            date = null;

            var tasks = values(personData.tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];

                tableItems.push({
                    date: date,
                    issue: taskData.key,
                    issueSummary: taskData.summary,
                    issueStatus: taskData.status,
                    timeSpent: taskData.timeLogged
                });

                var subtasks = values(taskData.subtasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
                for (var s in subtasks) {
                    var subtaskData = subtasks[s];

                    tableItems.push({
                        issue: subtaskData.key,
                        issueSummary: subtaskData.summary,
                        issueStatus: subtaskData.status,
                        parentIssue: taskData.key,
                        timeSpent: subtaskData.timeLogged
                    });
                }
            }

            if (tableItems.length > personRow + 1) {
                merges.push({index: personRow + 1, field: 'person', rowspan: tableItems.length - personRow - 1, colspan: 1});
            }
        }

        merges.push({index: dateRow, field: 'date', rowspan: tableItems.length - dateRow, colspan: 1});
    }


    table = $('#worklog');
    table.bootstrapTable({
        data: tableItems
    });

    for (var i = 0; i < merges.length; i++) {
        table.bootstrapTable('mergeCells', merges[i]);
    }

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

function renderProgressTable(issues) {

    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];


        var contributors = [];

        var lastWorklogDate = null;
        var worklogs = issue.fields.worklog.worklogs;
        for (j = 0; j < worklogs.length; j++) {
            var worklog = worklogs[j];

            // Date is in "2017-06-02T09:00:00.000+0100" format
            var date = Date.parse(worklog.started.substring(0, 10));
            if (lastWorklogDate == null || lastWorklogDate < date) {
                lastWorklogDate = date;
            }

            // Build unique list of worklog contributors
            contributors.push(worklog.author);
        }

        contributors = uniquePeople(contributors);

            var taskIssue = issue;
            if (issue.fields.parent) {
                taskIssue = issue.fields.parent;
            }

            var taskData = tasks[taskIssue.key];
            if (!taskData) {
                tasks[taskIssue.key] = taskData = {
                    key: taskIssue.key, 
                    summary: taskIssue.fields.summary,
                    status: taskIssue.fields.status.name,
                    lastWorklogDate: lastWorklogDate,
                    subtasks: {}
                };
            }

            if (taskIssue != issue) {
                var subtaskData = taskData.subtasks[issue.key];
                if (!subtaskData) {
                    taskData.subtasks[issue.key] = subtaskData = {
                        key: issue.key, 
                        summary: issue.fields.summary,
                        status: issue.fields.status.name,
                        timeEstimated: issue.fields.aggregatetimeoriginalestimate,
                        timeSpent: issue.fields.aggregatetimespent,
                        timeLeft: issue.fields.aggregatetimeestimate,
                        assignee: taskIssue.fields.assignee,
                        contributors: contributors,
                        lastWorklogDate: lastWorklogDate
                    };
                }
            } else {
                // Just in case we found parent later than stub was created
                taskData.timeEstimated = issue.fields.aggregatetimeoriginalestimate;
                taskData.timeSpent = issue.fields.aggregatetimespent;
                taskData.timeLeft = issue.fields.aggregatetimeestimate;
                taskData.assignee = issue.fields.assignee;
                taskData.contributors = contributors;
            }

            // Update parent's last worklog date
            if (taskData.lastWorklogDate < lastWorklogDate) {
                taskData.lastWorklogDate = lastWorklogDate;
            }

// timeestimate = remaining (for a ticket without subtickets)
// aggregatetimeestimate = remaining time (for a parent ticket)
    }

//    var cutoffDate = Date.parse("2017-06-02");

    var tableItems = [];
    var merges = [];

            var tasks = values(tasks)
//                         .filter(function(a) { return a.lastWorklogDate > cutoffDate; })
//                         .sort(function(a, b) { return compareJiraKey(b.key, a.key); });
                         .sort(function(a, b) { return compareStatus(b.status, a.status); });
            for (var t in tasks) {
                var taskData = tasks[t];

                var contributors = [];
                if (taskData.assignee != null) {
                    contributors.push(taskData.assignee);
                }
                add(contributors, taskData.contributors);
                subtasks = values(taskData.subtasks);
                for (var i = 0; i < subtasks.length; i++) {
                    var subtask = subtasks[i];
                    if (subtask.assignee != null) {
                        contributors.push(subtask.assignee);
                    }
                    add(contributors, subtask.contributors);
                }
                contributors = uniquePeople(contributors);

                tableItems.push({
                    issue: taskData.key,
                    issueSummary: taskData.summary,
                    issueStatus: taskData.status,
                    timeEstimated: taskData.timeEstimated,
                    timeSpent: taskData.timeSpent,
                    timeLeft: taskData.timeLeft,
                    assignee: taskData.assignee,
                    contributors: contributors,
                    timeProgress: {
                      estimated: taskData.timeEstimated,
                      spent: taskData.timeSpent,
                      left: taskData.timeLeft
                    }
                });
        }

    table = $('#progress');
    table.bootstrapTable({
        data: tableItems
    });

    for (var i = 0; i < merges.length; i++) {
        table.bootstrapTable('mergeCells', merges[i]);
    }

}

function processWorklogIssues(issues) {
    worklogIssuesData = issues;
    renderWorklogTable(issues);
};

async function loadWorklog() {

    await authenticate();

    var issues = await searchIssues({
        jql: "worklogDate > -5d AND worklogAuthor in membersOf('" + GROUP + "')",
        fields: "summary,timespent,aggregatetimespent,timeestimate,timeoriginalestimate,aggregatetimeestimate,aggregatetimeoriginalestimate,worklog,status,parent"
    });

    processWorklogIssues(issues);
}

function saveWorklogData() {
    saveJson(worklogIssuesData, "jira-issues-data.json");
}


function processProgressIssues(issues) {
    progressIssuesData = issues;
    renderProgressTable(issues);
};

async function loadProgress() {

    await authenticate();

    var issues = await searchIssues({
        jql: "project ='" + PROJECT + "' AND sprint in openSprints() and issuetype not in subtaskIssueTypes()",
        fields: "summary,timespent,aggregatetimespent,timeestimate,timeoriginalestimate,aggregatetimeestimate,aggregatetimeoriginalestimate,worklog,status,parent"
    });

    processProgressIssues(issues);
}

function saveProgressData() {
    saveJson(progressIssuesData, "jira-issues-data.json");
}

