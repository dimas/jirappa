

function worklogRowStyle(row, index) {
    if (!row.issue) {
        // Person group row
        return {
            css: {
                "background-color": "rgb(245, 245, 245)",
            }
        };

    } else if (row.parentIssue) {
        // A subticket
        return {
              css: {"color": "grey"}
        };

    } else {
        // Normal ticket
        return {
            css: {"vertical-align" : "top"} 
        };
    }
}


var worklogIssuesData = [];

function initWorklogTable() {
    table = $('#worklog');
    table.bootstrapTable({
    });
}

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
    table.bootstrapTable('load', tableItems);

    for (var i = 0; i < merges.length; i++) {
        table.bootstrapTable('mergeCells', merges[i]);
    }
}

function processWorklogIssues(issues) {
    worklogIssuesData = issues;
    renderWorklogTable(issues);
};

function saveWorklogData() {
    saveJson(worklogIssuesData, "jira-issues-data.json");
}

async function loadWorklog() {

    $('#worklog').bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "worklogDate > -7d AND worklogAuthor in membersOf('" + GROUP + "')",
        fields: "summary,timespent,aggregatetimespent,timeestimate,timeoriginalestimate,aggregatetimeestimate,aggregatetimeoriginalestimate,worklog,status,parent"
    });

    processWorklogIssues(issues);

    $('#worklog').bootstrapTable('hideLoading');
}


// Init tables and load data
$(function () {
    initWorklogTable();

    loadWorklog();
});

