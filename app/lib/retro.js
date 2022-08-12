
function personDisplayName(person) {
    // After one of our devs was removed from the organisation, I see him as a structure with
    // active=false, and 'name'. No 'key', no 'displayName', no avatar URLs....
    return person.displayName || person.name;
}

function formatContributors(contributors) {
    var result = '';
    for (var i = 0; i < contributors.length; i++) {
        let avatar;
        let name;
        // After one of our devs was removed from the organisation, we get a stub for him without any avatar URLs.
        if (contributors[i].avatarUrls) {
            avatar = contributors[i].avatarUrls['48x48'];
        } else {
            // On our JIRA this URL represents a small question mark "avatar" shown for Unassigned tasks
            avatar = JIRA_URL + 'secure/useravatar?size=small&avatarId=10123';
        }
        result += '<img style="width: 24px; height: 24px" src="' + avatar + '" title="' +  escapeText(personDisplayName(contributors[i])) + '"/>';
    }
    return result;
}

function rowStyle(row, index) {
    if (row.parentIssue) {
        return {
              css: {"color": "grey"}
        };
    }
    return { css: {"vertical-align" : "top"} };
}


var progressIssuesData;
var progressTable;

function initProgressTable() {
    progressTable = $('#progress');
    progressTable.bootstrapTable({
    });
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
                    contributors: [],
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

    progressTable.bootstrapTable('load', tableItems);

    for (var i = 0; i < merges.length; i++) {
        progressTable.bootstrapTable('mergeCells', merges[i]);
    }

}

function processProgressIssues(issues) {
    progressIssuesData = issues;
    renderProgressTable(issues);
};

async function loadProgress() {

    progressTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "project ='" + PROJECT + "' AND sprint in openSprints() and issuetype not in subtaskIssueTypes()",
        fields: "summary,timespent,aggregatetimespent,timeestimate,timeoriginalestimate,aggregatetimeestimate,aggregatetimeoriginalestimate,worklog,status,parent"
    });

    processProgressIssues(issues);

    progressTable.bootstrapTable('hideLoading');
}

function saveProgressData() {
    saveJson(progressIssuesData, "jira-issues-data.json");
}

// Init tables and load data
$(function () {
    initProgressTable();

    loadProgress();
});

