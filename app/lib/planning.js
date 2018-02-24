
function formatAssigneeSelector(assignee, row, index) {
    var result = '';

    result += '<select size="1" data-type="assignee" item-index="' + index + '">';

    result += '<option value=""></option>';

    for (var i = 0; i < teamMembers.length; i++) {
      result += '<option value="' + teamMembers[i].key + '"' + (row.selectedAssignee == teamMembers[i].key ? 'selected' : '') +   '>';
      result += teamMembers[i].displayName;
      result += '</option>';
    }

    result += '</select>';

    return result;
}

///////////////////////////////////////////////////////////////// SPRINTS

function populateSprintSelector(sprints) {

    var futureSprints = [];
    var seen = {};
    for (var i = 0; i < sprints.length; i++) {
        var sprint = sprints[i];
        if (sprint.state == 'future' && !seen[sprint.id]) {
            seen[sprint.id] = true;
            futureSprints.push(sprint);
        }
    }

    var options = $("#sprint-selector");
    options.empty();

    options.append(new Option());

    futureSprints = values(futureSprints).sort(compare);
    for (var i = 0; i < futureSprints.length; i++) {
        options.append(new Option(futureSprints[i].name, futureSprints[i].id));
    }

    options.on("change", async function(event) {
        event.preventDefault();
        await loadSprintPlan(options.val());
    });
}

async function discoverSprints() {

    await authenticate();

    boards = await loadPages(JIRA_REST_URL + "/rest/agile/1.0/board", 'values', {projectKeyOrId: PROJECT});

    promises = [];

    var projectSprints = [];
    for (var i = 0; i < boards.length; i++) {
        // type='kanban' boards will return:
        //     {"errorMessages":["The board does not support sprints"],"errors":{}}
        if (boards[i].type == 'scrum') {
            console.log("Loading sprints from agile board " + boards[i].id);
            promises.push(async function() {
              sprints = await loadPages(JIRA_REST_URL + "/rest/agile/1.0/board/" + boards[i].id + '/sprint', 'values', {});
              add(projectSprints, sprints);
            }());
        }
    }

    // Wait for all updates to complete
    await Promise.all(promises);

    // We have all the sprints data
    populateSprintSelector(projectSprints);
}


///////////////////////////////////////////////////////////////// DEVELOPER STATS

function formatAvailable(capacity, row) {
    return formatDurationDays(getAvailable(row));
}

function getAvailable(item) {
    return item.capacity - item.debt - item.selected;
}

function updateDeveloperDebt(index, value) {
    developersTableItems[index].debt = parseDurationDays(value);
    updateDevelopersTotals();
    $('#developers').bootstrapTable('updateRow', [
        {index: index, row: developersTableItems[index]},
        {index: developersTableItems.length - 1, row: developersTableItems[developersTableItems.length - 1]}
    ]);
}

function updateDeveloperCapacity(index, value) {
    developersTableItems[index].capacity = parseDurationDays(value);
    updateDevelopersTotals();
    $('#developers').bootstrapTable('updateRow', [
        {index: index, row: developersTableItems[index]},
        {index: developersTableItems.length - 1, row: developersTableItems[developersTableItems.length - 1]}
    ]);
}

function refreshDeveloperStatsTable() {
    // TODO: I am just asking table to update all its rows
    // TODO: this looks ugly but works. No idea ATM how to do it better
    var updates = [];
    for (var i = 0; i < developersTableItems.length; i++) {
        updates.push({index: i, row: developersTableItems[i]});
    }

    $('#developers').bootstrapTable('updateRow', updates);
}

function getDeveloperStatsItem(key) {
    for (var i = 0; i < developersTableItems.length; i++) {
        var item = developersTableItems[i];
        if (item.developer != null && key == item.developer.key) {
            return item;
        }
    }
    return null;
}

function developerStatsRowStyle(row, index) {
    if (row.developer == null) {
        return {
              css: {'font-weight': 'bold'}
        };
    }
    return { };
}

function formatDeveloperCapacity(capacity, row, index) {
    var value = formatDurationDays(capacity);
    if (row.developer != null) {
        return '<input type=text data-type="capacity" data-index="' + index  + '" value="' + value +  '" />';
    } else {
        // Totals
        return value;
    }
}


var teamMembers = [];

function updateDevelopersTotals() {

    if (developersTableItems.length < 1) {
        return;
    }

    totalsItem = developersTableItems[developersTableItems.length - 1];
    totalsItem.debt = 0;
    totalsItem.capacity = 0;
    totalsItem.selected = 0;

    for (var i = 0; i < developersTableItems.length - 1; i++) {
        totalsItem.debt += developersTableItems[i].debt;
        totalsItem.capacity += developersTableItems[i].capacity;
        totalsItem.selected += developersTableItems[i].selected;
    }
}

var developersTableItems;

function renderDevelopersTable() {

    var tableItems = [];

    for (var i = 0; i < teamMembers.length; i++) {
      tableItems.push({
          developer: teamMembers[i],
          displayName: teamMembers[i].displayName,
          debt: 0,
          capacity: parseDuration('9d'),
          selected: 0,
      });
    }

    tableItems.push({
        displayName: 'TOTAL',
        debt: 0,
        capacity: parseDuration('9d'),
        selected: 0,
    });

developersTableItems = tableItems;

    updateDevelopersTotals();

    table = $('#developers');
    table.bootstrapTable({
        data: tableItems
    });

    table.on("change", "input[data-type=debt]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateDeveloperDebt(input.attr('data-index'), input.val());
    }); 

    table.on("change", "input[data-type=capacity]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateDeveloperCapacity(input.attr('data-index'), input.val());
    });

}

function processUserIssues(issues) {

    var contributors = [];
    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var worklogs = issue.fields.worklog.worklogs;
        for (j = 0; j < worklogs.length; j++) {
            var worklog = worklogs[j];
            // Build unique list of worklog contributors
            contributors.push(worklog.author);
        }
    }

    teamMembers = uniquePeople(contributors).sort(function(a, b) { return compare(a.displayName, b.displayName); });
    renderDevelopersTable();
}


async function loadTeamMembers() {

    await authenticate();

    // I can think of several ways of getting users for a project
    //   1. Most obvious one - query our named group - /rest/api/2/group?groupname=#{GROUP}
    //      However for some weird reason it requires admin permissions
    //   2. Get all developers of a project with /rest/api/2/project/#{PROJECT}
    //      But someone has to configure the project properly (again, I do not have permissions).
    //      And  then it does not seem to be possible to use that for finding all the issues recently modified by users having particular role
    //      in the given project for worklog reports. So we will still have to use named group for that.
    //      And maintaining two groups sucks a bit
    //   3. Just find all worksheets done by members of our named group for the last month and build unique list of users.
    //      Not ideal (epecially when someone from another team submits worklog into our issues for any reason)
    //      but better than nothing.

    var issues = await searchIssues({
        jql: "worklogDate > -30d AND worklogAuthor in membersOf('" + GROUP + "')",
        fields: "worklog"
    });

    processUserIssues(issues);
}


///////////////////////////////////////////////////////////////// PLAN

var planTableItems;


function recalculateDevelopersSelected() {

    console.log("recalculateDevelopersSelected()");

    for (var i = 0; i < developersTableItems.length - 1; i++) {
        developersTableItems[i].selected = 0;
    }

    for (var i = 0; i < planTableItems.length; i++) {
        var item = planTableItems[i];
        var stats = getDeveloperStatsItem(item.selectedAssignee);
        if (stats != null) {
            stats.selected += item.timeProgress.estimated;
        }
    }
}


function updateAssignment(issueIndex, developerKey) {

console.log("updateAssignment(" + issueIndex + ", " + developerKey + ")");

    var item = planTableItems[issueIndex];
    item.selectedAssignee = developerKey;

    // If assignment has changed for a parent task, apply it to all subtasks as well
    for (var i = 0; i < planTableItems.length; i++) {
        if (planTableItems[i].parentIssue == item.issue) {
            planTableItems[i].selectedAssignee = developerKey;
            $('#plan').bootstrapTable('updateRow', [
                {index: i, row:planTableItems[i]}
            ]);
        }
    }

    recalculateDevelopersSelected();
    updateDevelopersTotals();
    refreshDeveloperStatsTable();
}

function processSprintIssues(issues) {

    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var parentIssue = issue.fields.parent; 
        if (parentIssue) {
            // It is a subtask
            var taskData = tasks[parentIssue.key];
            // Create parent issue if it is missing
            if (!taskData) {
                taskData = tasks[parentIssue.key] = {
                    subtasks: {}
                };
            }

            issueData = taskData.subtasks[issue.key] = {}

        } else {
            // It is a parent or a standalone issue
            // Note that it may exist in the map already if we found one of subtasks first
            // so we cannot just replace it or we will lose its existing 'subtasks' field
            issueData = tasks[issue.key];
            if (!issueData) {
                issueData = tasks[issue.key] = {
                    subtasks: {}
                };
            }
        }

        issueData.key = issue.key;
        issueData.summary = issue.fields.summary;
        issueData.status = issue.fields.status.name;
        issueData.timeEstimated = issue.fields.timeoriginalestimate;
        issueData.timeSpent = issue.fields.timespent;
        if (issue.fields.assignee) {
            issueData.assignee = issue.fields.assignee.key;
        }
    }

    var tableItems = [];
    var merges = [];

            var tasks = values(tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];
/*
                if (taskData.status == "In Test" || taskData.status == "Closed") {
                    // Ignore finished tasks
                    continue;
                }
*/
                tableItems.push({
                    issue: taskData.key,
                    issueSummary: taskData.summary,
                    issueStatus: taskData.status,
                    originalAssignee: taskData.assignee,
                    selectedAssignee: taskData.assignee,
                    timeProgress: {
                      estimated: taskData.timeEstimated,
                      spent: taskData.timeSpent,
                    },
                });

                var subtasks = values(taskData.subtasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
                for (var s in subtasks) {
                    var subtaskData = subtasks[s];

                    tableItems.push({
                        issue: subtaskData.key,
                        issueSummary: subtaskData.summary,
                        issueStatus: subtaskData.status,
                        parentIssue: taskData.key,
                        originalAssignee: subtaskData.assignee,
                        selectedAssignee: subtaskData.assignee,
                        timeProgress: {
                          estimated: subtaskData.timeEstimated,
                          spent: subtaskData.timeSpent,
                        },
                    });
                }
            }


    table = $('#plan');
    table.bootstrapTable('destroy');
    table.bootstrapTable({
        data: tableItems
    });

    planTableItems = tableItems;

    table.on("change", "select[data-type=assignee]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateAssignment(input.attr('item-index'), input.val());
    });

    recalculateDevelopersSelected();
    updateDevelopersTotals();
    refreshDeveloperStatsTable();
}

async function loadSprintPlan(id) {
    await authenticate();

    var issues = await searchIssues({
       jql: "Sprint=" + id + "",
       fields: 'status,summary,parent,assignee,timeoriginalestimate,timespent'
    });

    processSprintIssues(issues);
}

///////////////////////////////////////////////////////////////// DEBT


function formatIssueDebt(debt, row, index) {
    var value = formatDurationDays(debt);
    return '<input type=text data-type="debt" item-index="' + index  + '" value="' + value +  '" />';
}

var debtTableItems;

function recalculateDevelopersDebt() {

    for (var i = 0; i < developersTableItems.length - 1; i++) {
        developersTableItems[i].debt = 0;
    }

    for (var i = 0; i < debtTableItems.length; i++) {
        var item = debtTableItems[i];
        var stats = getDeveloperStatsItem(item.selectedAssignee);
        if (stats != null && item.debt > 0) {
            stats.debt += item.debt;
        }
    }
}

function updateIssueDebt(index, value) {
    debtTableItems[index].debt = parseDurationDays(value);
    $('#debt').bootstrapTable('updateRow', [
        {index: index, row: debtTableItems[index]}
    ]);
    recalculateDevelopersDebt();
    updateDevelopersTotals();
    refreshDeveloperStatsTable();
}

function updateDebtAssignment(index, developerIndex) {
    debtTableItems[index].selectedAssignee = developerIndex;
    recalculateDevelopersDebt();
    updateDevelopersTotals();
    refreshDeveloperStatsTable();
}

function processDebtIssues(issues) {
    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var parentIssue = issue.fields.parent; 
        if (parentIssue) {
            // It is a subtask
            var taskData = tasks[parentIssue.key];
            // Create parent issue if it is missing
            if (!taskData) {
                taskData = tasks[parentIssue.key] = {
                    subtasks: {}
                };
            }

            issueData = taskData.subtasks[issue.key] = {}

        } else {
            // It is a parent or a standalone issue
            // Note that it may exist in the map already if we found one of subtasks first
            // so we cannot just replace it or we will lose its existing 'subtasks' field
            issueData = tasks[issue.key];
            if (!issueData) {
                issueData = tasks[issue.key] = {
                    subtasks: {}
                };
            }
        }

        issueData.key = issue.key;
        issueData.summary = issue.fields.summary;
        issueData.status = issue.fields.status.name;
        issueData.timeEstimated = issue.fields.timeoriginalestimate;
        issueData.timeSpent = issue.fields.timespent;
        if (issue.fields.assignee) {
            issueData.selectedAssignee = issue.fields.assignee.key;
        }
    }


    var tableItems = [];
    var merges = [];

            var tasks = values(tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];

                if (taskData.status == "In Test" || taskData.status == "Closed") {
                    // Ignore finished tasks
                    continue;
                }

                tableItems.push({
                    issue: taskData.key,
                    issueSummary: taskData.summary,
                    issueStatus: taskData.status,
                    selectedAssignee: taskData.selectedAssignee,
                    timeProgress: {
                      estimated: taskData.timeEstimated,
                      spent: taskData.timeSpent,
                    },
                    debt: Math.max(0, taskData.timeEstimated - taskData.timeSpent),
                });

                var subtasks = values(taskData.subtasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
                for (var s in subtasks) {
                    var subtaskData = subtasks[s];

                    tableItems.push({
                        issue: subtaskData.key,
                        issueSummary: subtaskData.summary,
                        issueStatus: subtaskData.status,
                        parentIssue: taskData.key,
                        selectedAssignee: subtaskData.selectedAssignee,
                        timeProgress: {
                          estimated: subtaskData.timeEstimated,
                          spent: subtaskData.timeSpent,
                        },
                        debt: Math.max(0, subtaskData.timeEstimated - subtaskData.timeSpent),
                    });
                }
            }


    table = $('#debt');
    table.bootstrapTable({
        data: tableItems
    });

    debtTableItems = tableItems;

    table.on("change", "input[data-type=debt]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateIssueDebt(input.attr('item-index'), input.val());
    });

    table.on("change", "select[data-type=assignee]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateDebtAssignment(input.attr('item-index'), input.val());
    });


    recalculateDevelopersDebt();
    updateDevelopersTotals();
    refreshDeveloperStatsTable();
}

async function loadDebt() {
    await authenticate();
    var issues = await searchIssues({
        jql: "project ='" + PROJECT + "' AND sprint in openSprints()",
        fields: 'status,summary,parent,assignee,timeoriginalestimate,timespent'
    });

    processDebtIssues(issues);
}


/////////////////////////////////////////////////////////////////

function nullifyAssignee(assignee) {
    return assignee != null && assignee != "" ? assignee : null;
}

async function applyPlanAssignments() {

    promises = [];

    for (var i = 0; i < planTableItems.length; i++) {
        // 'let' instead of 'var' is important here otherwise callbacks (async functions) will see the same value of 'item'
        let item = planTableItems[i];

        if (item.originalAssignee == item.selectedAssignee) {
            // No change
            continue;
        }

        var original = nullifyAssignee(item.originalAssignee);
        var assignee = nullifyAssignee(item.selectedAssignee);

        console.log("reassign " + item.issue + " " + item.originalAssignee + " > " + assignee);

        if (original != null && assignee == null && getDeveloperStatsItem(original) == null) {
            // Looks like it was assigned to someone who is not one of our guys (so assignment was displayed as blank)
            // and then selection was moved back and forth and then returned to blank. But whoever did this, saw
            // blank in the beginning and he believed he restored it back to its original value.
            // So it is not the best idea to REALLY change assignment for this issue.
            continue;
        }

        promises.push(assignIssue(item.issue, assignee));
    }

    // Wait for all updates to complete
    await Promise.all(promises);
}

async function loadAll() {
    await loadTeamMembers();
    await Promise.all([
        loadDebt(),
        discoverSprints()
    ]);
}

